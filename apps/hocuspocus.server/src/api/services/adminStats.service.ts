/**
 * Admin Stats Service — Prisma aggregation + Supabase enrichment for the
 * dashboard, document list/CRUD, and admin-role management.
 */

import type { PrismaClient } from '@prisma/client'

import { adminLogger } from '../../lib/logger'
import { parseSupabaseArray, supabaseUsersArraySchema } from '../../schemas/supabase.schema'
import { getSupabaseClient, supabaseRest } from '../utils/supabase'
import { fetchByIds } from '../utils/supabaseFetchByIds'

type AdminClient = NonNullable<ReturnType<typeof getSupabaseClient>>

export async function getDashboardStats(prisma: PrismaClient) {
  const [totalDocuments, privateDocuments, readOnlyDocuments, totalVersions, recentDocuments] =
    await Promise.all([
      prisma.documentMetadata.count(),
      prisma.documentMetadata.count({ where: { isPrivate: true } }),
      prisma.documentMetadata.count({ where: { readOnly: true } }),
      prisma.documents.count(),
      prisma.documentMetadata.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      })
    ])

  return {
    documents: {
      total: totalDocuments,
      private: privateDocuments,
      readOnly: readOnlyDocuments,
      totalVersions,
      recentlyCreated: recentDocuments,
      avgVersionsPerDoc: totalDocuments > 0 ? Math.round(totalVersions / totalDocuments) : 0
    },
    refreshedAt: new Date().toISOString()
  }
}

export async function getDocumentStats(prisma: PrismaClient) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [total, privateCount, readOnlyCount, totalVersions, recentActivity] = await Promise.all([
    prisma.documentMetadata.count(),
    prisma.documentMetadata.count({ where: { isPrivate: true } }),
    prisma.documentMetadata.count({ where: { readOnly: true } }),
    prisma.documents.count(),
    prisma.documentMetadata.count({ where: { createdAt: { gte: sevenDaysAgo } } })
  ])

  return {
    total,
    private: privateCount,
    readOnly: readOnlyCount,
    totalVersions,
    avgVersionsPerDoc: total > 0 ? Math.round(totalVersions / total) : 0,
    recentActivity
  }
}

export interface ListDocumentsParams {
  page: number
  limit: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  search: string
}

const SORT_FIELD_MAP: Record<string, string> = {
  title: 'title',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
  versionCount: 'updatedAt'
}

export async function listDocuments(prisma: PrismaClient, params: ListDocumentsParams) {
  const { page, limit, sortBy, sortDir, search } = params
  const skip = (page - 1) * limit
  const orderField = SORT_FIELD_MAP[sortBy] || 'updatedAt'

  const whereClause = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } }
        ]
      }
    : {}

  const [documents, total] = await Promise.all([
    prisma.documentMetadata.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [orderField]: sortDir },
      select: {
        id: true,
        slug: true,
        documentId: true,
        title: true,
        description: true,
        isPrivate: true,
        readOnly: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        email: true,
        _count: { select: { documents: true } }
      }
    }),
    prisma.documentMetadata.count({ where: whereClause })
  ])

  const docsWithDefaults = documents.map((doc) => ({
    id: doc.id,
    docId: doc.slug,
    documentId: doc.documentId,
    title: doc.title,
    headline: doc.description,
    isPrivate: doc.isPrivate,
    readOnly: doc.readOnly,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    versionCount: doc._count.documents,
    ownerId: doc.ownerId,
    ownerEmail: doc.email,
    ownerName: null as string | null,
    ownerAvatarUrl: null as string | null,
    ownerAvatarUpdatedAt: null as string | null,
    memberCount: 0,
    views7d: 0,
    uniqueUsers7d: 0
  }))

  const ownerIds = [...new Set(documents.filter((d) => d.ownerId).map((d) => d.ownerId))]
  const slugs = documents.map((d) => d.slug)

  if (ownerIds.length > 0) {
    try {
      const rows = await fetchByIds(
        'users',
        'id',
        ownerIds as string[],
        'id,username,email,avatar_url,avatar_updated_at'
      )
      const users = parseSupabaseArray(supabaseUsersArraySchema, rows)
      if (users) {
        const userMap = new Map(users.map((u) => [u.id, u]))
        docsWithDefaults.forEach((doc) => {
          if (!doc.ownerId) return
          const user = userMap.get(doc.ownerId)
          if (user) {
            doc.ownerName = user.username || user.email?.split('@')[0] || null
            doc.ownerAvatarUrl = user.avatar_url || null
            doc.ownerAvatarUpdatedAt = user.avatar_updated_at || null
          }
        })
      }
    } catch (err) {
      adminLogger.error({ err }, 'Failed to fetch owners')
    }
  }

  if (slugs.length > 0) {
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        const { data: memberData, error: memberError } = await supabase.rpc(
          'admin_get_document_member_counts',
          { p_slugs: slugs }
        )
        if (memberError) {
          adminLogger.error({ err: memberError }, 'RPC admin_get_document_member_counts failed')
        } else if (Array.isArray(memberData)) {
          const memberMap = new Map(
            memberData.map((row: { slug: string; member_count: number }) => [
              row.slug,
              row.member_count
            ])
          )
          docsWithDefaults.forEach((doc) => {
            const count = memberMap.get(doc.docId)
            if (count !== undefined) doc.memberCount = count
          })
        }
      }
    } catch (err) {
      adminLogger.error({ err }, 'Failed to fetch member counts')
    }
  }

  if (slugs.length > 0) {
    try {
      const viewStats = await fetchByIds(
        'document_view_stats',
        'document_slug',
        slugs,
        'document_slug,views_7d,unique_users_7d'
      )
      const statsMap = new Map(
        (viewStats as { document_slug: string; views_7d: number; unique_users_7d: number }[]).map(
          (s) => [s.document_slug, { views7d: s.views_7d, uniqueUsers7d: s.unique_users_7d }]
        )
      )
      docsWithDefaults.forEach((doc) => {
        const stats = statsMap.get(doc.docId)
        if (stats) {
          doc.views7d = stats.views7d
          doc.uniqueUsers7d = stats.uniqueUsers7d
        }
      })
    } catch (err) {
      adminLogger.error({ err }, 'Failed to fetch view stats')
    }
  }

  return {
    data: docsWithDefaults.map((doc) => ({
      id: doc.id,
      docId: doc.docId,
      documentId: doc.documentId,
      title: doc.title,
      headline: doc.headline,
      isPrivate: doc.isPrivate,
      readOnly: doc.readOnly,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      versionCount: doc.versionCount,
      ownerId: doc.ownerId,
      ownerName: doc.ownerName,
      ownerEmail: doc.ownerEmail,
      ownerAvatarUrl: doc.ownerAvatarUrl,
      ownerAvatarUpdatedAt: doc.ownerAvatarUpdatedAt,
      memberCount: doc.memberCount,
      views7d: doc.views7d,
      uniqueUsers7d: doc.uniqueUsers7d
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }
}

export async function updateDocumentFlags(
  prisma: PrismaClient,
  id: number,
  updateData: Record<string, boolean>
) {
  const document = await prisma.documentMetadata.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      slug: true,
      title: true,
      isPrivate: true,
      readOnly: true,
      updatedAt: true
    }
  })

  return {
    success: true,
    document: {
      id: document.id,
      docId: document.slug,
      title: document.title,
      isPrivate: document.isPrivate,
      readOnly: document.readOnly,
      updatedAt: document.updatedAt
    }
  }
}

export async function getDocumentDeletionImpact(prisma: PrismaClient, id: number) {
  const document = await prisma.documentMetadata.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } }
  })
  if (!document) return null

  let workspace: { id: string; channelCount: number } | null = null
  let owner: { username: string | null; email: string | null } | null = null

  try {
    const workspaceRes = await supabaseRest(`workspaces?slug=eq.${document.slug}&select=id`)
    if (workspaceRes) {
      const workspaces = await workspaceRes.json()
      if (Array.isArray(workspaces) && workspaces.length > 0) {
        const workspaceId = workspaces[0].id
        const channelsRes = await supabaseRest(`channels?workspace_id=eq.${workspaceId}&select=id`)
        const channels = channelsRes ? await channelsRes.json() : []
        workspace = { id: workspaceId, channelCount: Array.isArray(channels) ? channels.length : 0 }
      }
    }
  } catch (err) {
    adminLogger.error({ err }, 'Failed to fetch workspace')
  }

  if (document.ownerId) {
    try {
      const userRes = await supabaseRest(`users?id=eq.${document.ownerId}&select=username,email`)
      if (userRes) {
        const users = await userRes.json()
        if (Array.isArray(users) && users.length > 0) {
          owner = { username: users[0].username, email: users[0].email }
        }
      }
    } catch (err) {
      adminLogger.error({ err }, 'Failed to fetch owner')
    }
  }
  if (!owner && document.email) owner = { username: null, email: document.email }

  return {
    document: {
      id: document.id,
      slug: document.slug,
      title: document.title,
      versionCount: document._count.documents,
      createdAt: document.createdAt
    },
    owner,
    workspace
  }
}

export async function deleteDocument(prisma: PrismaClient, id: number, confirmSlug: unknown) {
  const document = await prisma.documentMetadata.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, documentId: true }
  })
  if (!document) return { status: 'not_found' as const }
  if (confirmSlug !== document.slug) return { status: 'mismatch' as const }

  let workspaceDeleted = false
  try {
    const deleteRes = await supabaseRest(`workspaces?slug=eq.${document.slug}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    })
    workspaceDeleted = deleteRes?.ok ?? false
  } catch (err) {
    adminLogger.error({ err }, 'Failed to delete workspace')
  }

  await prisma.$transaction([
    prisma.documents.deleteMany({ where: { documentId: document.documentId } }),
    prisma.documentMetadata.delete({ where: { id } })
  ])

  return {
    status: 'deleted' as const,
    success: true,
    deleted: { id: document.id, slug: document.slug, title: document.title },
    workspaceDeleted
  }
}

export async function getUserDocumentCounts(prisma: PrismaClient): Promise<Record<string, number>> {
  const counts = await prisma.documentMetadata.groupBy({
    by: ['ownerId'],
    _count: { id: true },
    where: { ownerId: { not: null } }
  })

  const result: Record<string, number> = {}
  counts.forEach((row) => {
    if (row.ownerId) result[row.ownerId] = row._count.id
  })
  return result
}

export type ToggleAdminResult =
  | { status: 'ok'; is_admin: boolean }
  | { status: 'last_admin' }
  | { status: 'error'; message: string }

export async function toggleAdminRole(
  supabase: AdminClient,
  userId: string,
  currentAdminId: string | undefined
): Promise<ToggleAdminResult> {
  const { data: existing } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { count } = await supabase
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
    if ((count ?? 0) <= 1) return { status: 'last_admin' }

    const { error } = await supabase.from('admin_users').delete().eq('user_id', userId)
    if (error) return { status: 'error', message: error.message }
    return { status: 'ok', is_admin: false }
  }

  const { error } = await supabase
    .from('admin_users')
    .insert({ user_id: userId, created_by: currentAdminId || null })
  if (error) return { status: 'error', message: error.message }
  return { status: 'ok', is_admin: true }
}

export async function getAdminUserIds(supabase: AdminClient) {
  const { data, error } = await supabase.from('admin_users').select('user_id, created_at')
  if (error) return { status: 'error' as const, message: error.message }
  return { status: 'ok' as const, data: data || [] }
}
