import type { PrismaClient } from '@prisma/client'

import { sendNewDocumentNotification } from '../../../lib/email/document-notification'
import { emailLogger } from '../../../lib/logger'
import { normalizeSlug } from '../../../lib/slug'
import { createDocumentWithContent } from '../../document-content/infra/contentStore'
import type { ApplyActor, CreateOutcome, TiptapDocJson } from '../../document-content/types'
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

// slugify spells most scripts in Latin letters, but a Japanese title becomes ''.
const FALLBACK_SLUG = 'untitled'
// A document on one of these slugs would have no working link. Keep in step with
// `apps/webapp/src/utils/reservedSlugs.ts`, which refuses them in the document GSSP.
const ROUTE_SLUGS = new Set([
  'new',
  'editor',
  'receive',
  'privacy',
  'terms',
  'auth',
  'c',
  'oauth',
  'unsubscribe',
  '404',
  '500',
  'api'
])

const baseSlug = (title: string): string => {
  const slug = normalizeSlug(title) || FALLBACK_SLUG
  return ROUTE_SLUGS.has(slug) ? `${slug}-document` : slug
}

/** Not `documentsService.createDocument`: slugs are global, so its 409 would fail a common title. */
export const createOwnedDocument = async (
  prisma: PrismaClient,
  { title, content, actor }: { title: string; content: TiptapDocJson; actor: ApplyActor }
): Promise<CreateOutcome> => {
  const outcome = await createDocumentWithContent(prisma, {
    slug: baseSlug(title),
    title,
    content,
    ownerId: actor.sub,
    email: actor.email ?? null,
    actor,
    uniqueSlug: true
  })
  if (outcome.status === 'created') {
    const { documentId, slug, createdAt } = outcome.document
    // Version 1 already exists, so the worker's first-save notice never fires for it.
    setImmediate(() => {
      sendNewDocumentNotification({
        documentId,
        documentName: title,
        slug,
        creatorId: actor.sub,
        creatorEmail: actor.email,
        createdAt
      }).catch((err) => {
        emailLogger.error({ err, documentId }, 'Failed to send new document notification email')
      })
    })
  }
  return outcome
}
