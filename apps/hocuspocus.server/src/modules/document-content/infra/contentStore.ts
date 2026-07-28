import type { PrismaClient } from '@prisma/client'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'
import * as Y from 'yjs'

import { handlePrismaError } from '../../../lib/errors'
import { encodeContent } from '../domain/encodeContent'
import type { CreateOutcome, TiptapDocJson } from '../types'

export interface DocumentContentMeta {
  documentId: string
  slug: string
  ownerId: string | null
  email: string | null
  deletedAt: Date | null
}

export const findDocumentMeta = (
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentContentMeta | null> =>
  prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { documentId: true, slug: true, ownerId: true, email: true, deletedAt: true }
  })

/**
 * The persisted head. Strictly `version: 'desc'` — it is served by the
 * (documentId, version) unique index, while `id DESC` has none and scans.
 */
export const findHeadRow = (
  prisma: PrismaClient,
  documentId: string
): Promise<{ data: Buffer; version: number } | null> =>
  prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { data: true, version: true }
  }) as Promise<{ data: Buffer; version: number } | null>

export interface CreateWithContentParams {
  slug: string
  title?: string
  description?: string
  keywords?: string[]
  content: TiptapDocJson
  ownerId?: string | null
  email?: string | null
}

/**
 * Create a document and its version 1 in one transaction. Encoding runs first so
 * an invalid payload writes zero rows; a taken slug conflicts (P2002 → 409)
 * rather than being silently renamed or swallowed.
 */
export const createDocumentWithContent = async (
  prisma: PrismaClient,
  params: CreateWithContentParams
): Promise<CreateOutcome> => {
  const encoded = encodeContent(params.content, { requireTitleHeading: true })
  if (!encoded.ok) return { status: 'invalid-content', detail: encoded.detail }

  const data = Buffer.from(Y.encodeStateAsUpdate(encoded.scratch))
  const newSlug = slugify(params.slug.toLowerCase(), { lower: true, strict: true })
  const documentId = new ShortUniqueId().stamp(19)

  try {
    const document = await prisma.$transaction(async (tx) => {
      const metadata = await tx.documentMetadata.create({
        data: {
          documentId,
          slug: newSlug,
          title: params.title || newSlug,
          description: params.description || newSlug,
          keywords: params.keywords?.length ? params.keywords.join(', ') : '',
          ownerId: params.ownerId ?? null,
          email: params.email ?? null
        }
      })
      await tx.documents.create({
        data: { documentId, version: 1, data, commitMessage: '', trigger: 'api' }
      })
      return metadata
    })

    return { status: 'created', document }
  } catch (error) {
    throw handlePrismaError(error)
  }
}
