import { PrismaClient } from '@prisma/client'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'

import { publishDocumentAccessEvent } from '../../lib/accessRealtime'
import { handlePrismaError, ValidationError } from '../../lib/errors'
import { documentsServiceLogger } from '../../lib/logger'
import { canMutateAccessFlags, isDocumentOwner } from '../../lib/ownerAccess'
import { withUniqueSlug } from '../../lib/slug'
import { getServiceRoleClient } from '../../lib/supabase'
import type { CreateDocumentParams, SearchDocumentsParams, UpdateDocumentParams } from '../../types'
import { purgeDocumentFootprint } from './documentPurge.service'

const OWNER_PROFILE_COLUMNS = 'id, avatar_url, avatar_updated_at, full_name, display_name, status'

export const getOwnerProfile = async (userId: string) => {
  const supabase = getServiceRoleClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select(OWNER_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    documentsServiceLogger.warn({ err: error, userId }, 'Owner profile lookup failed')
    return null
  }
  return data || null
}

export const getOwnerProfiles = async (userIds: string[]) => {
  if (userIds.length === 0) return []
  const supabase = getServiceRoleClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('users')
    .select(OWNER_PROFILE_COLUMNS)
    .in('id', userIds)
  if (error) {
    documentsServiceLogger.warn(
      { err: error, count: userIds.length },
      'Owner profiles lookup failed'
    )
    return []
  }
  return data || []
}

export const createDraftDocument = (slug: string) => {
  const newSlug = slugify(slug.toLowerCase(), { lower: true, strict: true })
  const uid = new ShortUniqueId()
  const documentId = uid.stamp(19)

  return {
    slug: newSlug,
    title: newSlug,
    description: newSlug,
    documentId,
    keywords: '',
    ownerId: null,
    email: null,
    isPrivate: false
  }
}

export const createDocument = async (prisma: PrismaClient, params: CreateDocumentParams) => {
  const { slug, title, description = '', keywords = [], userId, email } = params

  if (!slug || slug.trim().length === 0) {
    throw new ValidationError('Slug is required and cannot be empty')
  }

  try {
    const newSlug = slugify(slug.toLowerCase(), { lower: true, strict: true })
    const uid = new ShortUniqueId()
    const documentId = uid.stamp(19)

    const newDocumentMeta = {
      slug: newSlug,
      title: title || newSlug,
      description: description || newSlug,
      documentId,
      keywords: keywords.length > 0 ? keywords.join(', ') : '',
      ownerId: userId || null,
      email: email || null
    }

    const doc = await prisma.documentMetadata.create({ data: newDocumentMeta })
    const ownerProfile = userId ? await getOwnerProfile(userId) : null

    documentsServiceLogger.info({ documentId, slug: newSlug }, 'Document created successfully')
    return { ...doc, ownerProfile }
  } catch (error) {
    documentsServiceLogger.error({ err: error, slug }, 'Error creating document')
    throw handlePrismaError(error)
  }
}

export const getDocumentBySlug = async (prisma: PrismaClient, slug: string) => {
  if (!slug || slug.trim().length === 0) {
    throw new ValidationError('Slug is required and cannot be empty')
  }

  try {
    const normalizedSlug = slugify(slug.toLowerCase(), { lower: true, strict: true })

    const doc = await prisma.documentMetadata.findUnique({
      where: { slug: normalizedSlug }
    })

    if (!doc) return null

    const keywords = doc.keywords
      ? doc.keywords
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean)
      : []

    const ownerProfile = doc.ownerId ? await getOwnerProfile(doc.ownerId) : null

    return { ...doc, keywords, ownerProfile }
  } catch (error) {
    documentsServiceLogger.error({ err: error, slug }, 'Error fetching document by slug')
    throw handlePrismaError(error)
  }
}

// Allowlisted sort keys → Prisma orderBy field + direction (mirrors admin SORT_FIELD_MAP).
const SORT_FIELD_MAP: Record<
  string,
  { field: 'updatedAt' | 'createdAt' | 'title'; dir: 'asc' | 'desc' }
> = {
  updatedAt_desc: { field: 'updatedAt', dir: 'desc' },
  createdAt_desc: { field: 'createdAt', dir: 'desc' },
  title_asc: { field: 'title', dir: 'asc' },
  title_desc: { field: 'title', dir: 'desc' }
}

export const searchDocuments = async (prisma: PrismaClient, params: SearchDocumentsParams) => {
  const {
    title,
    keywords: reqKeywords,
    description,
    ownerId,
    requesterId,
    deleted,
    sort,
    limit,
    offset
  } = params

  // Validate pagination parameters
  if (limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be between 1 and 100')
  }

  if (offset < 0) {
    throw new ValidationError('Offset must be non-negative')
  }

  try {
    let docs
    let total

    const { field: orderField, dir: orderDir } =
      SORT_FIELD_MAP[sort ?? 'updatedAt_desc'] ?? SORT_FIELD_MAP.updatedAt_desc
    // Trash is always newest-tombstone-first; the sort allowlist governs live lists only.
    const orderBy = deleted ? { deletedAt: 'desc' as const } : { [orderField]: orderDir }

    // Live lists hide soft-deleted rows until the reaper purges them; the Trash
    // view inverts that to show only the caller's tombstoned docs.
    const deletedWhere = deleted ? { deletedAt: { not: null } } : { deletedAt: null }

    // AND `ownerId` onto any existing WHERE so the search and owner
    // filter compose. When neither is set, the WHERE is undefined and
    // Prisma returns every row.
    const ownerWhere = ownerId ? { ownerId } : undefined

    // Fleet clamp: an unverified caller or an owner-less list must not enumerate
    // private rows. Owner-scoped calls (ownerId === token.sub) are unaffected.
    const privacyWhere = !requesterId || !ownerId ? { isPrivate: false } : {}

    if (title || reqKeywords || description) {
      // to_tsquery (the `search` clauses) throws a 500 on operator punctuation
      // like `C++` or `foo)`; reduce each token to bare word characters so bad
      // input returns no matches instead of crashing the endpoint.
      const searchTokens = [
        ...(title ? decodeURIComponent(title).split(' ') : []),
        ...(reqKeywords ? decodeURIComponent(reqKeywords).split(' ') : []),
        ...(description ? decodeURIComponent(description).split(' ') : [])
      ]
        .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
        .filter((x) => x && x !== 'undefined')

      const searchQuery = searchTokens.join(' & ')
      const searchWhere = {
        OR: [
          { title: { contains: searchQuery } },
          { title: { search: searchQuery } },
          { keywords: { search: searchQuery } },
          { description: { search: searchQuery } }
        ],
        ...(ownerWhere ?? {}),
        ...privacyWhere,
        ...deletedWhere
      }

      ;[docs, total] = await Promise.all([
        prisma.documentMetadata.findMany({
          skip: offset,
          take: limit,
          where: searchWhere,
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            documentId: true,
            keywords: true,
            ownerId: true,
            readOnly: true,
            isPrivate: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          },
          orderBy
        }),
        prisma.documentMetadata.count({ where: searchWhere })
      ])
    } else {
      const listWhere = { ...(ownerWhere ?? {}), ...privacyWhere, ...deletedWhere }

      ;[docs, total] = await Promise.all([
        prisma.documentMetadata.findMany({
          skip: offset,
          take: limit,
          where: listWhere,
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            documentId: true,
            keywords: true,
            ownerId: true,
            readOnly: true,
            isPrivate: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          },
          orderBy
        }),
        prisma.documentMetadata.count({ where: listWhere })
      ])
    }

    const formattedDocs = docs.map((doc: any) => ({
      ...doc,
      keywords: doc.keywords
        ? doc.keywords
            .split(',')
            .map((k: string) => k.trim())
            .filter(Boolean)
        : []
    }))

    // Enrich with owner profiles
    const ownerIds = formattedDocs.filter((doc: any) => doc.ownerId).map((doc: any) => doc.ownerId!)
    const ownerProfiles = await getOwnerProfiles(ownerIds)

    const docsWithOwners = formattedDocs.map((doc: any) => {
      if (!doc.ownerId) return doc

      const ownerProfile = ownerProfiles.find((profile: any) => profile.id === doc.ownerId)
      if (!ownerProfile) return doc

      // snake_case mirrors `public.users` so the FE consumes the same
      // shape it gets from every other user-profile fetch.
      return {
        ...doc,
        owner: {
          id: ownerProfile.id,
          avatar_url: ownerProfile.avatar_url,
          avatar_updated_at: ownerProfile.avatar_updated_at,
          display_name: ownerProfile.display_name || ownerProfile.full_name,
          status: ownerProfile.status
        }
      }
    })

    documentsServiceLogger.debug(
      { count: docsWithOwners.length, total },
      'Documents searched successfully'
    )
    return { docs: docsWithOwners, total }
  } catch (error) {
    documentsServiceLogger.error({ err: error, params }, 'Error searching documents')
    throw handlePrismaError(error)
  }
}

export const updateDocument = async (
  prisma: PrismaClient,
  documentId: string,
  params: UpdateDocumentParams,
  requesterId?: string
) => {
  const { title, description, keywords, readOnly, isPrivate } = params

  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  try {
    // Title/description/keywords are collaborative and open. readOnly/isPrivate are
    // privileged locks: only the owner (or any authed caller on an ownerless doc)
    // may change them; unauthorized changes are ignored so collaborative edits still
    // succeed.
    const existing = await prisma.documentMetadata.findUnique({
      where: { documentId },
      select: { ownerId: true, readOnly: true, isPrivate: true }
    })

    const updateData: {
      description?: string
      title?: string
      keywords?: string
      readOnly?: boolean
      isPrivate?: boolean
    } = {}
    if (description !== undefined) updateData.description = description
    if (title !== undefined) updateData.title = title
    if (keywords !== undefined) updateData.keywords = keywords.join(',')

    const mayMutateAccess = canMutateAccessFlags(existing, requesterId)

    const readOnlyChanged = readOnly !== undefined && (!existing || readOnly !== existing.readOnly)
    if (readOnlyChanged && mayMutateAccess) {
      updateData.readOnly = readOnly
    } else if (readOnlyChanged) {
      documentsServiceLogger.warn(
        { documentId, requesterId },
        'Ignored unauthorized readOnly change'
      )
    }

    const privateChanged =
      isPrivate !== undefined && (!existing || isPrivate !== existing.isPrivate)
    if (privateChanged && mayMutateAccess) {
      updateData.isPrivate = isPrivate
    } else if (privateChanged) {
      documentsServiceLogger.warn(
        { documentId, requesterId },
        'Ignored unauthorized isPrivate change'
      )
    }

    const upsertedDoc = await prisma.documentMetadata.upsert({
      where: { documentId },
      update: updateData,
      create: {
        documentId,
        slug: title ? slugify(title.toLowerCase(), { lower: true, strict: true }) : documentId,
        title: title || documentId,
        description: description || '',
        keywords: keywords ? keywords.join(',') : '',
        ownerId: requesterId || null,
        ...updateData
      }
    })

    if (updateData.isPrivate !== undefined || updateData.readOnly !== undefined) {
      // Fire-and-forget seal; DB write already succeeded for new connects.
      // Only include changed fields so a readOnly flip on an already-private doc
      // does not re-broadcast private / re-kick.
      void publishDocumentAccessEvent({
        documentId,
        ...(updateData.isPrivate !== undefined ? { isPrivate: upsertedDoc.isPrivate } : {}),
        ...(updateData.readOnly !== undefined ? { readOnly: upsertedDoc.readOnly } : {}),
        ownerId: upsertedDoc.ownerId,
        timestamp: new Date().toISOString()
      }).then((ok) => {
        if (!ok) {
          documentsServiceLogger.warn(
            { documentId },
            'Document access event publish failed after metadata update'
          )
        }
      })
    }

    documentsServiceLogger.info({ documentId }, 'Document updated successfully')

    return {
      ...upsertedDoc,
      keywords: upsertedDoc.keywords
        ? upsertedDoc.keywords
            .split(',')
            .map((k: string) => k.trim())
            .filter(Boolean)
        : []
    }
  } catch (error) {
    documentsServiceLogger.error({ err: error, documentId }, 'Error updating document')
    throw handlePrismaError(error)
  }
}

export type OwnerGuardedWrite = { authorized: boolean }

// Strict-owner soft-delete/restore. The ownership read is intentionally NOT
// deletedAt-filtered: restore targets a soft-deleted row, and idempotent
// re-delete relies on the still-present tombstone row resolving to the owner.
const setDeletedAt = async (
  prisma: PrismaClient,
  documentId: string,
  requesterId: string | undefined,
  deletedAt: Date | null
): Promise<OwnerGuardedWrite> => {
  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const existing = await prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { ownerId: true }
  })
  if (!isDocumentOwner(existing, requesterId)) return { authorized: false }

  try {
    await prisma.documentMetadata.update({ where: { documentId }, data: { deletedAt } })
  } catch (error) {
    // P2025 = row already gone (reaper/race); soft-delete + restore are idempotent.
    if ((error as { code?: string }).code === 'P2025') return { authorized: true }
    documentsServiceLogger.error({ err: error, documentId }, 'Error toggling document deletedAt')
    throw handlePrismaError(error)
  }
  return { authorized: true }
}

export const softDeleteDocument = (
  prisma: PrismaClient,
  documentId: string,
  requesterId?: string
) => setDeletedAt(prisma, documentId, requesterId, new Date())

export const restoreDocument = (prisma: PrismaClient, documentId: string, requesterId?: string) =>
  setDeletedAt(prisma, documentId, requesterId, null)

export type DuplicateDocumentResult =
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'ok'; document: { documentId: string; slug: string; title: string } }

// Strict-owner duplicate. Copies the source's latest Yjs bytes verbatim into a
// fresh doc — no history rebuild. Media stays SHARED: the copy references the
// same storage objects rather than cloning them (safe today; nothing purges a
// source's media out from under a copy).
export const duplicateDocument = async (
  prisma: PrismaClient,
  sourceDocumentId: string,
  requesterId?: string,
  email?: string | null
): Promise<DuplicateDocumentResult> => {
  if (!sourceDocumentId || sourceDocumentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const source = await prisma.documentMetadata.findUnique({
    where: { documentId: sourceDocumentId },
    select: { ownerId: true, title: true, description: true, keywords: true, deletedAt: true }
  })

  // Owner-gate first (a missing source is also non-owner → 403, mirroring
  // delete/restore), then the soft-delete seal (404, consistent with reads).
  if (!isDocumentOwner(source, requesterId)) return { status: 'forbidden' }
  if (source?.deletedAt) return { status: 'not-found' }

  try {
    const latest = await prisma.documents.findFirst({
      where: { documentId: sourceDocumentId },
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      select: { data: true }
    })
    const bytes = latest?.data ?? null

    const uid = new ShortUniqueId()
    const documentId = uid.stamp(19)
    const title = `${source?.title ?? ''} (copy)`.trim()
    const baseSlug = slugify(title.toLowerCase(), { lower: true, strict: true })

    const created = await withUniqueSlug(baseSlug, (slug) =>
      prisma.documentMetadata.create({
        data: {
          slug,
          title,
          description: source?.description ?? '',
          documentId,
          keywords: source?.keywords ?? '',
          ownerId: requesterId,
          email: email ?? null,
          isPrivate: false,
          readOnly: false,
          deletedAt: null
        }
      })
    )

    // A source that has never been persisted has no bytes to copy; the copy is
    // then a fresh empty doc that hydrates on first open (same as any new doc).
    if (bytes) {
      await prisma.documents.create({
        data: { documentId, commitMessage: '', version: 1, data: bytes }
      })
    }

    documentsServiceLogger.info(
      { sourceDocumentId, documentId: created.documentId },
      'Document duplicated successfully'
    )
    return {
      status: 'ok',
      document: {
        documentId: created.documentId,
        slug: created.slug,
        title: created.title ?? title
      }
    }
  } catch (error) {
    documentsServiceLogger.error({ err: error, sourceDocumentId }, 'Error duplicating document')
    throw handlePrismaError(error)
  }
}

export type PermanentDeleteResult =
  { status: 'forbidden' } | { status: 'not-deleted' } | { status: 'ok' }

// Immediate footprint purge for a soft-deleted doc (Trash "Delete forever"),
// sharing the reaper's purge. Refuses a live doc so it can't hard-delete an active
// one; owner-checked before the deletedAt check so state never leaks to a non-owner;
// a missing (already-purged) row resolves to ok (idempotent).
export const permanentlyDeleteDocument = async (
  prisma: PrismaClient,
  documentId: string,
  requesterId?: string
): Promise<PermanentDeleteResult> => {
  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const existing = await prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { ownerId: true, slug: true, deletedAt: true }
  })

  if (!existing) return { status: 'ok' }
  if (!isDocumentOwner(existing, requesterId)) return { status: 'forbidden' }
  if (!existing.deletedAt) return { status: 'not-deleted' }

  try {
    await purgeDocumentFootprint(prisma, getServiceRoleClient(), {
      documentId,
      slug: existing.slug
    })
  } catch (error) {
    documentsServiceLogger.error({ err: error, documentId }, 'Error purging document footprint')
    throw handlePrismaError(error)
  }
  return { status: 'ok' }
}

// Bulk Trash purge. `ids` omitted → every soft-deleted doc the requester owns
// (Empty trash); `ids` present → that selection. Each id runs through the
// single-doc purge so owner + soft-deleted gating and idempotency are reused
// verbatim; the count reflects rows actually purged. Sequential on purpose —
// each purge fans out to storage + the Supabase footprint RPC (parallelising
// would hammer both).
//
// Scale: this is synchronous, so a very large trash (hundreds) could exceed the
// request timeout. Fine for realistic owner-scoped trashes (the 30-day reaper
// bounds accumulation); if that assumption breaks, move the loop to the BullMQ
// worker (which already runs the reaper's purge) and return a queued response
// rather than capping — a bare `take` would silently leave the trash non-empty.
export const purgeTrash = async (
  prisma: PrismaClient,
  requesterId: string,
  ids?: string[]
): Promise<{ purged: number }> => {
  // Defense-in-depth: a falsy owner would drop Prisma's `ownerId` filter on the
  // empty-all query and match EVERY tenant's trash. requireUser already prevents
  // this — guard anyway so the cross-tenant scope is impossible by construction.
  if (!requesterId) return { purged: 0 }

  let targetIds = ids
  if (!targetIds) {
    const rows = await prisma.documentMetadata.findMany({
      where: { ownerId: requesterId, deletedAt: { not: null } },
      select: { documentId: true }
    })
    targetIds = rows.map((r) => r.documentId)
  }

  let purged = 0
  for (const documentId of targetIds) {
    const result = await permanentlyDeleteDocument(prisma, documentId, requesterId)
    if (result.status === 'ok') purged += 1
  }
  return { purged }
}

// Bulk Trash restore — clears deletedAt on each owned id (non-owner ids are
// silently skipped, mirroring the single-doc 403). Count reflects rows restored.
export const restoreTrash = async (
  prisma: PrismaClient,
  requesterId: string,
  ids: string[]
): Promise<{ restored: number }> => {
  let restored = 0
  for (const documentId of ids) {
    const result = await restoreDocument(prisma, documentId, requesterId)
    if (result.authorized) restored += 1
  }
  return { restored }
}
