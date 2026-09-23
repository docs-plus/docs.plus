import type { PrismaClient } from '@prisma/client'

import { normalizeSlug } from '../../../lib/slug'
import type { DocumentListing, DocumentRecord } from '../types'

/** Lean on purpose: `getDocumentBySlug` adds a Supabase profile call per read. */
export const findDocumentBySlug = (
  prisma: PrismaClient,
  slug: string
): Promise<DocumentRecord | null> =>
  prisma.documentMetadata.findUnique({
    where: { slug: normalizeSlug(slug) },
    select: {
      documentId: true,
      slug: true,
      isPrivate: true,
      readOnly: true,
      ownerId: true,
      deletedAt: true
    }
  })

// Prisma sends `contains` to ILIKE unescaped, so a bare `%` matched every row.
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`)

/** `mine` is the caller's own live documents; `public` is anyone's, never a private one. */
export const listDocuments = (
  prisma: PrismaClient,
  args: { scope: 'mine' | 'public'; ownerId: string; query?: string; limit: number }
): Promise<DocumentListing[]> =>
  prisma.documentMetadata.findMany({
    where: {
      deletedAt: null,
      ...(args.scope === 'mine' ? { ownerId: args.ownerId } : { isPrivate: false }),
      ...(args.query
        ? { title: { contains: escapeLike(args.query), mode: 'insensitive' as const } }
        : {})
    },
    select: {
      slug: true,
      title: true,
      updatedAt: true,
      isPrivate: true,
      readOnly: true,
      ownerId: true
    },
    orderBy: { updatedAt: 'desc' },
    take: args.limit
  })
