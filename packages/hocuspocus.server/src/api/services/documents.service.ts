import { PrismaClient } from '@prisma/client'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'

import { handlePrismaError, ValidationError } from '../../lib/errors'
import { documentsServiceLogger } from '../../lib/logger'
import type { CreateDocumentParams, SearchDocumentsParams, UpdateDocumentParams } from '../../types'

// Service-role client — bypasses RLS so the server can read full user
// rows (the `anon` column GRANT excludes `email` and silently 42501s a
// `select('email')`, which was the symptom showing every owner as
// "Unknown" in Settings → Documents).
let supabaseService: SupabaseClient | null = null
const getSupabase = (): SupabaseClient | null => {
  if (supabaseService) return supabaseService
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  supabaseService = createClient(url, key, { auth: { persistSession: false } })
  return supabaseService
}

const OWNER_PROFILE_COLUMNS = 'id, avatar_url, avatar_updated_at, full_name, display_name, status'

export const getOwnerProfile = async (userId: string) => {
  const supabase = getSupabase()
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
  const supabase = getSupabase()
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

export const searchDocuments = async (prisma: PrismaClient, params: SearchDocumentsParams) => {
  const { title, keywords: reqKeywords, description, ownerId, limit, offset } = params

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

    // AND `ownerId` onto any existing WHERE so the search and owner
    // filter compose. When neither is set, the WHERE is undefined and
    // Prisma returns every row.
    const ownerWhere = ownerId ? { ownerId } : undefined

    if (title || reqKeywords || description) {
      const searchTokens = [
        ...(title ? decodeURIComponent(title).split(' ') : []),
        ...(reqKeywords ? decodeURIComponent(reqKeywords).split(' ') : []),
        ...(description ? decodeURIComponent(description).split(' ') : [])
      ].filter((x) => x && x !== 'undefined')

      const searchQuery = searchTokens.join(' & ')
      const searchWhere = {
        OR: [
          { title: { contains: searchQuery } },
          { title: { search: searchQuery } },
          { keywords: { search: searchQuery } },
          { description: { search: searchQuery } }
        ],
        ...(ownerWhere ?? {})
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
            createdAt: true,
            updatedAt: true
          }
        }),
        prisma.documentMetadata.count({ where: searchWhere })
      ])
    } else {
      ;[docs, total] = await Promise.all([
        prisma.documentMetadata.findMany({ skip: offset, take: limit, where: ownerWhere }),
        prisma.documentMetadata.count({ where: ownerWhere })
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
  params: UpdateDocumentParams
) => {
  const { title, description, keywords, readOnly } = params

  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  try {
    const updateData: any = {}
    if (description !== undefined) updateData.description = description
    if (title !== undefined) updateData.title = title
    if (keywords !== undefined) updateData.keywords = keywords.join(',')
    if (readOnly !== undefined) updateData.readOnly = readOnly

    const upsertedDoc = await prisma.documentMetadata.upsert({
      where: { documentId },
      update: updateData,
      create: {
        documentId,
        slug: title ? slugify(title.toLowerCase(), { lower: true, strict: true }) : documentId,
        title: title || documentId,
        description: description || '',
        keywords: keywords ? keywords.join(',') : '',
        ...updateData
      }
    })

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
