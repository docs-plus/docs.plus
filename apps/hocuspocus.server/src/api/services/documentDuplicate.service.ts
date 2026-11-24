import ShortUniqueId from 'short-unique-id'

import type { PrismaClient } from '../../generated/prisma/client'
import { decideDocumentAccess } from '../../lib/documentAccess'
import {
  AppError,
  handlePrismaError,
  InternalServerError,
  PayloadTooLargeError,
  ValidationError
} from '../../lib/errors'
import { acquireLargeDecode } from '../../lib/largeDecodeGate'
import { documentsServiceLogger } from '../../lib/logger'
import { resolvePrivateAccess } from '../../lib/privateAccess'
import { rehostMediaUrls } from '../../lib/rehostMediaUrls'
import { normalizeSlug, withUniqueSlug } from '../../lib/slug'
import { MAX_DUPLICATE_MEDIA_OBJECTS } from '../../schemas/hypermultimedia.schema'
import { copyDocumentMedia, deleteDocumentMedia } from './media.service'

export type DuplicateDocumentResult =
  | { status: 'not-found' }
  | { status: 'busy' }
  | { status: 'ok'; document: { documentId: string; slug: string; title: string } }

// Duplicate of the source's latest Yjs bytes into a fresh copy owned by the requester —
// no history rebuild, and the source row is never mutated or claimed (CONTEXT.md:81).
// Any non-anonymous signed-in user may duplicate a readable public, public Read-only,
// or Open document; Private, trashed, and missing sources collapse to `not-found` so
// Private existence never leaks.
// Media is RE-HOSTED, not shared. The snapshot is scanned first, then exactly the
// objects it names are cloned under the copy's own prefix and its URLs repointed
// there. FORWARD-ONLY — copies made before this still share their source's objects.
export const duplicateDocument = async (
  prisma: PrismaClient,
  sourceDocumentId: string,
  requesterId: string,
  email?: string | null
): Promise<DuplicateDocumentResult> => {
  if (!sourceDocumentId || sourceDocumentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const source = await prisma.documentMetadata.findUnique({
    where: { documentId: sourceDocumentId },
    select: {
      ownerId: true,
      slug: true,
      title: true,
      description: true,
      keywords: true,
      deletedAt: true,
      isPrivate: true,
      readOnly: true
    }
  })

  // Collapse missing, trashed, and unreadable Private docs to `not-found` so no
  // non-owner can distinguish a Private document from an absent or trashed one.
  const access = decideDocumentAccess(source, { userId: requesterId }, 'read')
  if (!source || access !== 'allow') return { status: 'not-found' }

  const uid = new ShortUniqueId()
  const documentId = uid.stamp(19)

  try {
    // Strictly version desc — served top-1 by the (documentId, version) unique
    // index. Leading on createdAt walked Documents_createdAt_idx backwards past
    // every row the whole corpus wrote since this document's last save.
    const latest = await prisma.documents.findFirst({
      where: { documentId: sourceDocumentId },
      orderBy: { version: 'desc' },
      select: { data: true }
    })
    let bytes = latest?.data ?? null

    // Scan before copy: the snapshot names which objects are live and under whose prefix —
    // a copy of a copy still names the original. `data` is null when it names none, so the
    // no-media path writes the source bytes untouched. Objects before rows: a throw here
    // leaves only orphans, which the catch removes.
    // Gate snapshots at or above LARGE_DECODE_BYTES behind the process-wide decode slot
    // (zero cost below 4 MiB) so concurrent large duplicates cannot OOM rest-api's 512M cgroup.
    let rehosted: ReturnType<typeof rehostMediaUrls> | null = null
    if (bytes) {
      const release = await acquireLargeDecode(bytes.byteLength, 0)
      if (!release) return { status: 'busy' }
      try {
        rehosted = rehostMediaUrls(bytes, documentId)
      } finally {
        release()
      }
    }
    if (rehosted?.data) {
      // A URL may name a trashed document's prefix, or a Private one the requester
      // cannot read. Copying it would serve that media again under the copy's public
      // prefix. So the copy shows a missing image there, as for a purged one.
      const prefixes = [...new Set(rehosted.references.map((ref) => ref.documentId))]
      const prefixRows = await prisma.documentMetadata.findMany({
        where: { documentId: { in: prefixes } },
        select: { documentId: true, deletedAt: true, isPrivate: true, ownerId: true }
      })
      const refusedIds = new Set(
        prefixRows
          .filter(
            (row) =>
              row.deletedAt !== null ||
              resolvePrivateAccess({
                isPrivate: row.isPrivate,
                ownerId: row.ownerId,
                userId: requesterId
              }) !== 'allow'
          )
          .map((row) => row.documentId)
      )
      const live = rehosted.references.filter((ref) => !refusedIds.has(ref.documentId))

      // Refused before a single object is written, so nothing needs rolling back.
      if (live.length > MAX_DUPLICATE_MEDIA_OBJECTS) {
        throw new PayloadTooLargeError(
          `This document references ${live.length} media objects, ` +
            `over the ${MAX_DUPLICATE_MEDIA_OBJECTS} a duplicate may copy`
        )
      }
      try {
        await copyDocumentMedia(live, documentId)
      } catch (error) {
        // An object-store outage is not a database fault; keep it out of
        // `handlePrismaError`, which would group it as a DatabaseError.
        throw error instanceof AppError
          ? error
          : new InternalServerError("Failed to copy the source document's media")
      }
      bytes = rehosted.data
    }

    const title = `${source.title?.trim() || source.slug || 'Untitled'} (copy)`
    const baseSlug = normalizeSlug(title)

    // One transaction, because the two writes are the copy: metadata alone is a
    // document whose snapshot never landed. The slug retry stays outside it —
    // a P2002 aborts the transaction, so the retry has to open a new one.
    const created = await withUniqueSlug(baseSlug, (slug) =>
      prisma.$transaction(async (tx) => {
        const meta = await tx.documentMetadata.create({
          data: {
            slug,
            title,
            description: source.description ?? '',
            documentId,
            keywords: source.keywords ?? '',
            ownerId: requesterId,
            email: email ?? null,
            isPrivate: false,
            readOnly: false,
            deletedAt: null
          }
        })

        // A source that has never been persisted has no bytes to copy. The copy is
        // then a fresh empty doc that hydrates on first open (same as any new doc).
        if (bytes) {
          await tx.documents.create({
            data: { documentId, commitMessage: '', version: 1, data: bytes }
          })
        }
        return meta
      })
    )

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
    // Unconditional: a copy that threw partway still wrote objects, and both
    // adapters treat "nothing under this prefix" as a no-op. Outside the row
    // transaction, which rolls itself back.
    await deleteDocumentMedia(documentId).catch((cleanupError) =>
      documentsServiceLogger.error(
        { err: cleanupError, documentId },
        "Failed to roll back a duplicate's re-hosted media"
      )
    )
    documentsServiceLogger.error({ err: error, sourceDocumentId }, 'Error duplicating document')
    throw error instanceof AppError ? error : handlePrismaError(error)
  }
}
