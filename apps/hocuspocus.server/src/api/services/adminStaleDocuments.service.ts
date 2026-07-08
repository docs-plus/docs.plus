/**
 * Admin Stale-Documents Service — cross-database staleness scoring/caching.
 *
 * Stale scoring is cross-database (version/age in Prisma, views in Supabase),
 * so the full score+sort cannot be a single SQL query. We push a lossless
 * candidate prefilter into Postgres, then cache the scored list per query.
 */

import { TiptapTransformer } from '@hocuspocus/transformer'
import type { PrismaClient } from '@prisma/client'
import * as Y from 'yjs'

import { adminLogger } from '../../lib/logger'
import { supabaseRest } from '../utils/supabase'
import { fetchByIds } from '../utils/supabaseFetchByIds'

const CACHE_TTL_MS = 5 * 60 * 1000

// Hard cap on candidate documents scored in memory per refresh. A doc can only
// be stale if it cleared the SQL prefilter, so this bounds the worst case
// without dropping rows silently (we log when the cap is hit).
const MAX_STALE_CANDIDATES = 5000

// Bound the parsed-structure cache so re-pagination is cheap without unbounded
// memory growth; entries share the 5-min staleness window.
const MAX_STRUCTURE_CACHE = 2000

export interface DocumentStructure {
  headings: number
  paragraphs: number
}

type TiptapNode = { type?: string; text?: string; content?: unknown[] }

// Decode Y.js update bytes to the ProseMirror tree and visit every node. Throws
// (bad bytes) propagate to the caller so each can shape its own failure value.
function walkTiptapDoc(data: Buffer | Uint8Array | null, visit: (node: TiptapNode) => void): void {
  if (!data) return
  const ydoc = new Y.Doc()
  const buffer = data instanceof Buffer ? new Uint8Array(data) : data
  Y.applyUpdate(ydoc, buffer)

  const json = TiptapTransformer.fromYdoc(ydoc, 'default') as { content?: unknown[] } | null
  if (!json?.content || !Array.isArray(json.content)) return

  const recurse = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as TiptapNode
    visit(n)
    if (Array.isArray(n.content)) n.content.forEach(recurse)
  }
  json.content.forEach(recurse)
}

/** Parse Y.js update bytes into structural counts via @hocuspocus/transformer. */
function parseDocumentStructure(data: Buffer | Uint8Array | null): DocumentStructure {
  let headings = 0
  let paragraphs = 0
  try {
    walkTiptapDoc(data, (n) => {
      if (n.type === 'heading') headings++
      if (n.type === 'paragraph') paragraphs++
    })
  } catch {
    return { headings: 0, paragraphs: 0 }
  }
  return { headings, paragraphs }
}

const structureCache = new Map<string, { structure: DocumentStructure; expiresAt: number }>()

/** Multi-signal staleness scoring (edit + view activity). */
export function computeStaleScore(
  views7d: number,
  views30d: number,
  versionCount: number,
  daysInactive: number
): { score: number; reason: string } {
  if (views30d === 0 && daysInactive > 90) return { score: 100, reason: 'Truly Abandoned' }
  if (views7d === 0 && versionCount <= 1) return { score: 90, reason: 'Ghost Document' }
  if (views7d === 0 && daysInactive > 30) return { score: 70, reason: 'Declining Interest' }
  if (views7d < 3 && daysInactive > 60) return { score: 50, reason: 'Low Engagement' }
  return { score: 0, reason: '' }
}

interface ViewStat {
  views_7d: number
  views_30d: number
  last_viewed_at?: string | null
}

async function fetchViewStatsMap(slugs: string[]): Promise<Map<string, ViewStat>> {
  const map = new Map<string, ViewStat>()
  if (slugs.length === 0) return map

  try {
    const viewStats = await fetchByIds(
      'document_view_stats',
      'document_slug',
      slugs,
      'document_slug,views_7d,views_30d,last_viewed_at'
    )
    ;(viewStats as ({ document_slug: string } & ViewStat)[]).forEach((v) => {
      map.set(v.document_slug, {
        views_7d: v.views_7d || 0,
        views_30d: v.views_30d || 0,
        last_viewed_at: v.last_viewed_at || null
      })
    })
  } catch (err) {
    adminLogger.error({ err }, 'Failed to fetch view stats')
  }
  return map
}

interface OwnerInfo {
  username: string | null
  email: string | null
  avatar_url: string | null
}

async function fetchOwnerMap(ownerIds: string[]): Promise<Map<string, OwnerInfo>> {
  const map = new Map<string, OwnerInfo>()
  if (ownerIds.length === 0) return map

  try {
    const users = await fetchByIds('users', 'id', ownerIds, 'id,username,email,avatar_url')
    ;(users as ({ id: string } & OwnerInfo)[]).forEach((u) => {
      map.set(u.id, {
        username: u.username || null,
        email: u.email || null,
        avatar_url: u.avatar_url || null
      })
    })
  } catch (err) {
    adminLogger.error({ err }, 'Failed to fetch owners')
  }
  return map
}

interface CandidateRow {
  slug: string
  document_id: string
  title: string | null
  created_at: Date
  updated_at: Date
  is_private: boolean
  owner_id: string | null
  owner_email: string | null
  version_count: number
  days_inactive: number
  age_days: number
}

/**
 * Fetch stale *candidates* — rows that could score > 0 given the cross-DB rule.
 * A doc is non-stale regardless of views unless it is edit-inactive (>30d) or
 * has <=1 version, so this prefilter is lossless and shrinks the scan in SQL.
 */
async function fetchStaleCandidates(prisma: PrismaClient): Promise<CandidateRow[]> {
  const rows = await prisma.$queryRaw<
    (Omit<CandidateRow, 'version_count'> & { version_count: bigint })[]
  >`
    SELECT
      dm.slug,
      dm."documentId" AS document_id,
      dm.title,
      dm."createdAt" AS created_at,
      dm."updatedAt" AS updated_at,
      dm."isPrivate" AS is_private,
      dm."ownerId" AS owner_id,
      dm.email AS owner_email,
      COUNT(d.id) AS version_count,
      EXTRACT(DAY FROM NOW() - dm."updatedAt")::integer AS days_inactive,
      EXTRACT(DAY FROM NOW() - dm."createdAt")::integer AS age_days
    FROM "DocumentMetadata" dm
    LEFT JOIN "Documents" d ON d."documentId" = dm."documentId"
    GROUP BY dm.id
    HAVING EXTRACT(DAY FROM NOW() - dm."updatedAt")::integer > 30 OR COUNT(d.id) <= 1
    ORDER BY dm."updatedAt" ASC
    LIMIT ${MAX_STALE_CANDIDATES + 1}
  `

  if (rows.length > MAX_STALE_CANDIDATES) {
    adminLogger.warn(
      { cap: MAX_STALE_CANDIDATES },
      'Stale candidate cap hit — oldest candidates beyond the cap are not scored this refresh'
    )
    rows.length = MAX_STALE_CANDIDATES
  }

  return rows.map((r) => ({ ...r, version_count: Number(r.version_count) }))
}

export interface ScoredStaleDoc extends Omit<CandidateRow, 'version_count'> {
  version_count: number
  stale_score: number
  stale_reason: string
  views_7d: number
  views_30d: number
  last_viewed_at: string | null
}

/** Score every candidate against Supabase view stats (cross-DB join in memory). */
async function scoreCandidates(rows: CandidateRow[]): Promise<ScoredStaleDoc[]> {
  // document_view_stats.document_slug stores lower(trim(documentId)); key on the
  // lowercased documentId, not the human slug, or every join returns zero rows.
  const viewStatsMap = await fetchViewStatsMap(rows.map((d) => d.document_id.toLowerCase()))
  return rows.map((doc) => {
    const views = viewStatsMap.get(doc.document_id.toLowerCase()) || {
      views_7d: 0,
      views_30d: 0,
      last_viewed_at: null
    }
    const { score, reason } = computeStaleScore(
      views.views_7d,
      views.views_30d,
      doc.version_count,
      doc.days_inactive
    )
    return {
      ...doc,
      stale_score: score,
      stale_reason: reason,
      views_7d: views.views_7d,
      views_30d: views.views_30d,
      last_viewed_at: views.last_viewed_at ?? null
    }
  })
}

// Cache the scored stale set (the cross-DB heavy step) so pagination and
// repeat loads within the TTL avoid re-scanning Prisma + Supabase.
let scoredCache: { data: ScoredStaleDoc[]; expiresAt: number } | null = null

async function getScoredStaleDocs(prisma: PrismaClient): Promise<ScoredStaleDoc[]> {
  if (scoredCache && Date.now() < scoredCache.expiresAt) return scoredCache.data
  const candidates = await fetchStaleCandidates(prisma)
  const scored = await scoreCandidates(candidates)
  scoredCache = { data: scored, expiresAt: Date.now() + CACHE_TTL_MS }
  return scored
}

export interface StaleSummary {
  total_stale: number
  truly_abandoned: number
  ghost_document: number
  declining: number
  low_engagement: number
  recoverable_bytes: number
}

let summaryCache: { data: StaleSummary; expiresAt: number } | null = null

export async function getStaleSummary(prisma: PrismaClient): Promise<StaleSummary> {
  if (summaryCache && Date.now() < summaryCache.expiresAt) return summaryCache.data

  const scored = await getScoredStaleDocs(prisma)

  // Recoverable bytes needs storage size; fetch only for stale doc ids in one query.
  const staleDocIds = scored.filter((d) => d.stale_score > 0).map((d) => d.document_id)
  let recoverableBytes = 0
  if (staleDocIds.length > 0) {
    const storageRows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(LENGTH(data::text)), 0) AS total
      FROM "Documents"
      WHERE "documentId" = ANY(${staleDocIds})
    `
    recoverableBytes = Number(storageRows[0]?.total ?? 0n)
  }

  const summary: StaleSummary = {
    total_stale: 0,
    truly_abandoned: 0,
    ghost_document: 0,
    declining: 0,
    low_engagement: 0,
    recoverable_bytes: recoverableBytes
  }
  for (const doc of scored) {
    if (doc.stale_score > 0) summary.total_stale++
    if (doc.stale_score === 100) summary.truly_abandoned++
    else if (doc.stale_score === 90) summary.ghost_document++
    else if (doc.stale_score === 70) summary.declining++
    else if (doc.stale_score === 50) summary.low_engagement++
  }

  summaryCache = { data: summary, expiresAt: Date.now() + CACHE_TTL_MS }
  return summary
}

export interface StaleListParams {
  page: number
  limit: number
  minScore: number
  sortBy: string
  sortDir: 'asc' | 'desc'
}

export interface StaleListItem {
  slug: string
  title: string | null
  created_at: string
  updated_at: string
  is_private: boolean
  owner_id: string | null
  owner_email: string | null
  version_count: number
  age_days: number
  days_inactive: number
  stale_score: number
  stale_reason: string
  views_7d: number
  views_30d: number
  owner_name: string | null
  owner_avatar_url: string | null
  structure: DocumentStructure
}

export interface StaleListResult {
  data: StaleListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/** Fetch + cache the parsed structure for the page's documents only. */
async function getStructures(
  prisma: PrismaClient,
  documentIds: string[]
): Promise<Map<string, DocumentStructure>> {
  const out = new Map<string, DocumentStructure>()
  const now = Date.now()
  const missing: string[] = []

  for (const id of documentIds) {
    const cached = structureCache.get(id)
    if (cached && now < cached.expiresAt) out.set(id, cached.structure)
    else missing.push(id)
  }

  if (missing.length > 0) {
    const latestDocs = await prisma.$queryRaw<{ documentId: string; data: Buffer }[]>`
      SELECT DISTINCT ON ("documentId") "documentId", data
      FROM "Documents"
      WHERE "documentId" = ANY(${missing})
      ORDER BY "documentId", id DESC
    `
    const dataMap = new Map(latestDocs.map((d) => [d.documentId, d.data]))
    for (const id of missing) {
      const structure = parseDocumentStructure(dataMap.get(id) ?? null)
      out.set(id, structure)
      if (structureCache.size >= MAX_STRUCTURE_CACHE) {
        const oldest = structureCache.keys().next().value
        if (oldest !== undefined) structureCache.delete(oldest)
      }
      structureCache.set(id, { structure, expiresAt: now + CACHE_TTL_MS })
    }
  }

  return out
}

export async function listStale(
  prisma: PrismaClient,
  params: StaleListParams
): Promise<StaleListResult> {
  const { page, limit, minScore, sortBy, sortDir } = params

  const scored = await getScoredStaleDocs(prisma)
  const filtered = scored.filter((d) => d.stale_score >= minScore && d.stale_score > 0)

  const sortKey = sortBy as keyof ScoredStaleDoc
  filtered.sort((a, b) => {
    const aVal = a[sortKey] ?? 0
    const bVal = b[sortKey] ?? 0
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    }
    return 0
  })

  const total = filtered.length
  const offset = (page - 1) * limit
  const pageRows = filtered.slice(offset, offset + limit)

  const structures = await getStructures(prisma, pageRows.map((r) => r.document_id).filter(Boolean))

  const ownerIds = [...new Set(pageRows.filter((d) => d.owner_id).map((d) => d.owner_id!))]
  const ownerMap = await fetchOwnerMap(ownerIds)

  const data: StaleListItem[] = pageRows.map((row) => {
    const owner = row.owner_id ? ownerMap.get(row.owner_id) : undefined
    return {
      slug: row.slug,
      title: row.title,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      is_private: row.is_private,
      owner_id: row.owner_id,
      owner_email: row.owner_email,
      version_count: row.version_count,
      age_days: row.age_days,
      days_inactive: row.days_inactive,
      stale_score: row.stale_score,
      stale_reason: row.stale_reason,
      views_7d: row.views_7d,
      views_30d: row.views_30d,
      owner_name: owner ? owner.username || owner.email?.split('@')[0] || null : null,
      owner_avatar_url: owner?.avatar_url ?? null,
      structure: structures.get(row.document_id) ?? { headings: 0, paragraphs: 0 }
    }
  })

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
}

/** Owner summary (username/email) for the document-preview endpoint. */
export async function fetchOwnerSummary(
  ownerId: string
): Promise<{ username: string | null; email: string | null } | null> {
  const map = await fetchOwnerMap([ownerId])
  const u = map.get(ownerId)
  return u ? { username: u.username, email: u.email } : null
}

export interface DeletionImpact {
  workspace_id: string | null
  channel_count: number
  message_count: number
}

/** Workspace/channel/message counts for the document-preview deletion warning. */
export async function fetchDocumentDeletionImpact(slug: string): Promise<DeletionImpact> {
  const impact: DeletionImpact = { workspace_id: null, channel_count: 0, message_count: 0 }
  try {
    const workspaceRes = await supabaseRest(`workspaces?slug=eq.${slug}&select=id`)
    if (!workspaceRes) return impact
    const workspaces = await workspaceRes.json()
    if (!Array.isArray(workspaces) || workspaces.length === 0) return impact

    const workspaceId = workspaces[0].id
    impact.workspace_id = workspaceId

    const channelsRes = await supabaseRest(`channels?workspace_id=eq.${workspaceId}&select=id`)
    if (!channelsRes) return impact
    const channels = await channelsRes.json()
    impact.channel_count = Array.isArray(channels) ? channels.length : 0
    if (!Array.isArray(channels) || channels.length === 0) return impact

    const channelIds = channels.map((ch: { id: string }) => `"${ch.id}"`).join(',')
    const messagesRes = await supabaseRest(`messages?channel_id=in.(${channelIds})&select=id`, {
      headers: { Prefer: 'count=exact' }
    })
    if (messagesRes) {
      const match = messagesRes.headers.get('content-range')?.match(/\/(\d+)$/)
      if (match) impact.message_count = parseInt(match[1])
    }
  } catch (err) {
    adminLogger.error({ err }, 'Failed to fetch deletion impact')
  }
  return impact
}

export interface BulkDeleteStaleResult {
  dryRun?: boolean
  documentsFound?: number
  documents?: { slug: string; title: string | null }[]
  success?: boolean
  deleted?: number
  failed?: number
  workspacesDeleted?: number
  deletedDocuments?: { slug: string; title: string | null }[]
  failedDocuments?: { slug: string; error: string }[]
}

export async function bulkDeleteStale(
  prisma: PrismaClient,
  slugs: string[],
  dryRun: boolean
): Promise<BulkDeleteStaleResult> {
  const documents = await prisma.documentMetadata.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true, documentId: true }
  })

  if (dryRun) {
    return {
      dryRun: true,
      documentsFound: documents.length,
      documents: documents.map((d) => ({ slug: d.slug, title: d.title }))
    }
  }

  let workspacesDeleted = 0
  const deleted: { slug: string; title: string | null }[] = []
  const failed: { slug: string; error: string }[] = []

  for (const doc of documents) {
    try {
      const deleteRes = await supabaseRest(`workspaces?slug=eq.${doc.slug}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      })
      if (deleteRes?.ok) workspacesDeleted++

      await prisma.$transaction([
        prisma.documents.deleteMany({ where: { documentId: doc.documentId } }),
        prisma.documentMetadata.delete({ where: { id: doc.id } })
      ])
      deleted.push({ slug: doc.slug, title: doc.title })
    } catch (err) {
      failed.push({ slug: doc.slug, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return {
    success: true,
    deleted: deleted.length,
    failed: failed.length,
    workspacesDeleted,
    deletedDocuments: deleted,
    failedDocuments: failed
  }
}

/** Extract a 500-char text preview from a stored document's latest version. */
function parseContentPreview(data: Buffer | Uint8Array | null): string {
  const parts: string[] = []
  try {
    walkTiptapDoc(data, (n) => {
      if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
    })
  } catch {
    return '(Unable to parse content)'
  }
  return parts.join(' ').slice(0, 500)
}

export interface DocumentPreview {
  slug: string
  title: string | null
  content_preview: string
  version_count: number
  created_at: string
  updated_at: string
  owner: { username: string | null; email: string | null } | null
  deletion_impact: DeletionImpact
}

/** Assemble the document-preview payload (content, owner, deletion impact). */
export async function getDocumentPreview(
  prisma: PrismaClient,
  slug: string
): Promise<DocumentPreview | null> {
  const doc = await prisma.documentMetadata.findUnique({
    where: { slug },
    include: { _count: { select: { documents: true } } }
  })
  if (!doc) return null

  const latestVersion = await prisma.documents.findFirst({
    where: { documentId: doc.documentId },
    orderBy: { id: 'desc' },
    select: { data: true }
  })

  const contentPreview = latestVersion?.data
    ? parseContentPreview(latestVersion.data)
    : '(No content)'

  let owner: { username: string | null; email: string | null } | null = null
  if (doc.ownerId) owner = await fetchOwnerSummary(doc.ownerId)
  if (!owner && doc.email) owner = { username: null, email: doc.email }

  const deletionImpact = await fetchDocumentDeletionImpact(slug)

  return {
    slug: doc.slug,
    title: doc.title,
    content_preview: contentPreview,
    version_count: doc._count.documents,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString(),
    owner,
    deletion_impact: deletionImpact
  }
}

/** Invalidate stale caches after a delete so counts/lists reflect removals. */
export function invalidateStaleCaches(): void {
  scoredCache = null
  summaryCache = null
}
