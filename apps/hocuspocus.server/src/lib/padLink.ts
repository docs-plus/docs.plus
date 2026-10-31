/**
 * The server's one way to build a pad link: the shared Pad URL format, keyed on the pad slug.
 * It imports no Redis and no database client, so a unit test loads it with no infrastructure.
 */
import { type PadTarget, padUrlCore } from '@docs.plus/pad-url'

import type { PrismaClient } from '../generated/prisma/client'
import { type ContentChangeMetadata, resolveContentChangeAudience } from './contentChangeAudience'

/** `format` needs an origin to parse against; only the path form is read from it. */
const PATH_BASE = 'http://pad.invalid'

/**
 * Prefixing `appUrl` to the path keeps any path inside `APP_URL`. With no `appUrl` the
 * link is relative, so the push service worker resolves it against its own scope.
 */
export function padLink(target: PadTarget & { slug: string }, appUrl = ''): string {
  const ctx = { origin: PATH_BASE, live: `/${target.slug}`, trailOf: () => null }
  return `${appUrl}${padUrlCore.format(target, ctx, 'path')}`
}

/** The columns a link needs: the slug, and the audience fields that decide who may open it. */
export interface PadLinkRow extends ContentChangeMetadata {
  documentId: string
  slug: string
  title: string | null
}

/** One batched read by documentId, in exact case. A missing id has no row. */
export function readPadLinkRows(
  prisma: PrismaClient,
  documentIds: string[]
): Promise<PadLinkRow[]> {
  if (documentIds.length === 0) return Promise.resolve([])
  return prisma.documentMetadata.findMany({
    where: { documentId: { in: documentIds } },
    select: {
      documentId: true,
      slug: true,
      title: true,
      isPrivate: true,
      ownerId: true,
      deletedAt: true
    }
  })
}

/** Null when the reader cannot open the pad: no row, trashed, or Private to someone else. */
export function openableSlug(row: PadLinkRow | null | undefined, readerId: string): string | null {
  if (!row) return null
  const audience = resolveContentChangeAudience(row)
  const mayOpen =
    audience.kind === 'all' || (audience.kind === 'owner' && audience.onlyUser === readerId)
  return mayOpen ? row.slug : null
}
