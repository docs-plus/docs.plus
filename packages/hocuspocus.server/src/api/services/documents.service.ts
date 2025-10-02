import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'

interface CreateDocumentParams {
  slug: string
  title: string
  description?: string
  keywords?: string[]
  userId?: string
  email?: string
}

interface UpdateDocumentParams {
  title?: string
  description?: string
  keywords?: string[]
  readOnly?: boolean
}

interface SearchDocumentsParams {
  title?: string
  keywords?: string
  description?: string
  limit: number
  offset: number
}

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

  return { ...doc, ownerProfile }
}

export const getDocumentBySlug = async (prisma: PrismaClient, slug: string) => {
  const normalizedSlug = slugify(slug.toLowerCase(), { lower: true, strict: true })

  const doc = await prisma.documentMetadata.findUnique({
    where: { slug: normalizedSlug }
  })

  if (!doc) return null

  const keywords = doc.keywords
    ? doc.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    : []

  const ownerProfile = doc.ownerId ? await getOwnerProfile(doc.ownerId) : null

  return { ...doc, keywords, ownerProfile }
}

export const searchDocuments = async (prisma: PrismaClient, params: SearchDocumentsParams) => {
  const { title, keywords: reqKeywords, description, limit, offset } = params

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

  const formattedDocs = docs.map((doc) => ({
    ...doc,
    keywords: doc.keywords
      ? doc.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : []
  }))

  // Enrich with owner profiles
  const ownerIds = formattedDocs.filter((doc) => doc.ownerId).map((doc) => doc.ownerId!)
  const ownerProfiles = await getOwnerProfiles(ownerIds)

  const docsWithOwners = formattedDocs.map((doc) => {
    if (!doc.ownerId) return doc

    const ownerProfile = ownerProfiles.find((profile) => profile.id === doc.ownerId)
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

  return { docs: docsWithOwners, total }
}

export const updateDocument = async (
  prisma: PrismaClient,
  documentId: string,
  params: UpdateDocumentParams
) => {
  const { title, description, keywords, readOnly } = params

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

  return {
    ...upsertedDoc,
    keywords: upsertedDoc.keywords
      ? upsertedDoc.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : []
  }
}
