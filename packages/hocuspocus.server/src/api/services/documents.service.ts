import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'
import type { CreateDocumentParams, UpdateDocumentParams, SearchDocumentsParams } from '../../types'
import { handlePrismaError, NotFoundError, ValidationError } from '../../lib/errors'
import { documentsServiceLogger } from '../../lib/logger'

export const getOwnerProfile = async (userId: string) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data || null
}

export const getOwnerProfiles = async (userIds: string[]) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || userIds.length === 0) {
    return []
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data } = await supabase
    .from('users')
    .select('avatar_url, id, full_name, display_name, email, status')
    .in('id', userIds)

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
  const { title, keywords: reqKeywords, description, limit, offset } = params

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

    if (title || reqKeywords || description) {
      const searchTokens = [
        ...(title ? decodeURIComponent(title).split(' ') : []),
        ...(reqKeywords ? decodeURIComponent(reqKeywords).split(' ') : []),
        ...(description ? decodeURIComponent(description).split(' ') : [])
      ].filter((x) => x && x !== 'undefined')

      const searchQuery = searchTokens.join(' & ')

      ;[docs, total] = await Promise.all([
        prisma.documentMetadata.findMany({
          skip: offset,
          take: limit,
          where: {
            OR: [
              { title: { contains: searchQuery } },
              { title: { search: searchQuery } },
              { keywords: { search: searchQuery } },
              { description: { search: searchQuery } }
            ]
          },
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
        prisma.documentMetadata.count({
          where: {
            OR: [
              { title: { contains: searchQuery } },
              { title: { search: searchQuery } },
              { keywords: { search: searchQuery } },
              { description: { search: searchQuery } }
            ]
          }
        })
      ])
    } else {
      ;[docs, total] = await Promise.all([
        prisma.documentMetadata.findMany({ skip: offset, take: limit }),
        prisma.documentMetadata.count()
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
      const displayName = ownerProfile?.display_name || ownerProfile?.full_name || ownerProfile?.email

      return {
        ...doc,
        owner: {
          avatar_url: ownerProfile?.avatar_url,
          displayName,
          status: ownerProfile?.status
        }
      }
    })

    documentsServiceLogger.debug({ count: docsWithOwners.length, total }, 'Documents searched successfully')
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
