import ShortUniqueId from 'short-unique-id'

import type { PrismaClient } from '../../generated/prisma/client'
import { publishDocumentAccessEvent } from '../../lib/accessRealtime'
import { writeDocumentAccessMirror } from '../../lib/documentAccessMirror'
import { deriveDocumentId, INITIAL_EPOCH } from '../../lib/documentId'
import { AppError, handlePrismaError, NotFoundError, ValidationError } from '../../lib/errors'
import { documentsServiceLogger } from '../../lib/logger'
import { isDocumentOwner, isOpenDocument } from '../../lib/ownerAccess'
import { forgetPadCards } from '../../lib/padLinkCards'
import { isPadTitleChange, notifyPadTitleChange } from '../../lib/padTitleChange'
import { getOwnerProfile } from '../../lib/profiles'
import { normalizeSlug } from '../../lib/slug'
import { getServiceRoleClient } from '../../lib/supabase'
import type { CreateDocumentParams, UpdateDocumentParams } from '../../types'
import { purgeDocumentFootprint } from './documentPurge.service'

export { duplicateDocument, type DuplicateDocumentResult } from './documentDuplicate.service'

// Derived, so two people opening one new slug share a room instead of forking into
// two documents. Random only where derivation cannot apply: an empty normalized slug,
// or a candidate another row already holds.
const resolveDraftDocumentId = async (prisma: PrismaClient, normalizedSlug: string) => {
  if (!normalizedSlug) return new ShortUniqueId().stamp(19)

  const epochRow = await prisma.documentSlugEpoch.findUnique({
    where: { slug: normalizedSlug },
    select: { epoch: true }
  })
  const candidate = deriveDocumentId(normalizedSlug, epochRow?.epoch ?? INITIAL_EPOCH)

  // NOT a collision guard — a derived id is publicly computable, so anyone can claim
  // one first and force this slug back to a random id. Keep it: without the probe that
  // squatter's document would be served to the next visitor. It is TOCTOU against an
  // anchor landing after it, and it cannot stop a squatter who never anchors.
  const taken = await prisma.documentMetadata.findUnique({
    where: { documentId: candidate },
    select: { id: true }
  })
  if (!taken) return candidate

  documentsServiceLogger.warn({ slug: normalizedSlug, candidate }, 'Derived documentId taken')
  return new ShortUniqueId().stamp(19)
}

export const createDraftDocument = async (prisma: PrismaClient, slug: string) => {
  const newSlug = normalizeSlug(slug)
  const documentId = await resolveDraftDocumentId(prisma, newSlug)

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

// Anchor a draft's identity on the first real edit, so a reload's slug lookup returns the
// same documentId: the IndexedDB key and WS room the mirror restores early edits from.
// The row may carry the first signed-in editor as owner. skipDuplicates cedes when the row is
// already anchored or a concurrent first-open won the slug: no write, no error log, no claim.
export const ensureDraftDocumentMetadata = async (
  prisma: PrismaClient,
  params: { documentId: string; slug: string; ownerId?: string | null; email?: string | null }
): Promise<boolean> => {
  const newSlug = normalizeSlug(params.slug)
  if (!newSlug) return false

  const { count } = await prisma.documentMetadata.createMany({
    data: [
      {
        documentId: params.documentId,
        slug: newSlug,
        title: newSlug,
        description: newSlug,
        keywords: '',
        ownerId: params.ownerId ?? null,
        email: params.email ?? null
      }
    ],
    skipDuplicates: true
  })
  return count === 1
}

export const createDocument = async (prisma: PrismaClient, params: CreateDocumentParams) => {
  const { slug, title, description = '', keywords = [], userId, email } = params

  if (!slug || slug.trim().length === 0) {
    throw new ValidationError('Slug is required and cannot be empty')
  }

  try {
    const newSlug = normalizeSlug(slug)
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

    const doc = await prisma.documentMetadata.create({
      data: newDocumentMeta,
      select: PUBLIC_METADATA_SELECT
    })
    const ownerProfile = userId ? await getOwnerProfile(userId) : null

    documentsServiceLogger.info({ documentId, slug: newSlug }, 'Document created successfully')
    return { ...doc, ownerProfile }
  } catch (error) {
    documentsServiceLogger.error({ err: error, slug }, 'Error creating document')
    throw handlePrismaError(error)
  }
}

export const getDocumentBySlug = async (prisma: PrismaClient, slug: string, withCard: boolean) => {
  if (!slug || slug.trim().length === 0) {
    throw new ValidationError('Slug is required and cannot be empty')
  }

  try {
    const normalizedSlug = normalizeSlug(slug)

    const doc = await prisma.documentMetadata.findUnique({
      where: { slug: normalizedSlug },
      // `cardData` is for the page head's card only; `attachCard` strips `cardData`.
      select: withCard ? { ...PUBLIC_METADATA_SELECT, cardData: true } : PUBLIC_METADATA_SELECT
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

/** Create, slug GET, update, and the public fleet. Never `preview`, `lastOpenedAt` or `cardData`. */
export const PUBLIC_METADATA_SELECT = {
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
} as const

export const updateDocument = async (
  prisma: PrismaClient,
  documentId: string,
  params: UpdateDocumentParams,
  requesterId?: string
) => {
  const { title, description, keywords, readOnly, isPrivate, slug } = params

  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  try {
    // An owned document belongs to its owner: title, description, keywords and both
    // locks move only for them. An ownerless one is open — anyone may retitle it,
    // signed in or not — until the ownership handoff feature gives it an owner.
    const existing = await prisma.documentMetadata.findUnique({
      where: { documentId },
      select: { ownerId: true, readOnly: true, isPrivate: true, deletedAt: true, title: true }
    })

    if (existing?.deletedAt) throw new NotFoundError('Document')

    // A purged id must stay gone. Without this, a PUT from a stale tab would re-create
    // its row, or edit one the worker re-created, and bring the erased document back.
    // The WS gate reads the tombstone the same way.
    const tombstone = await prisma.documentPurgeTombstone.findUnique({
      where: { documentId },
      select: { documentId: true }
    })
    if (tombstone) throw new NotFoundError('Document')

    // The route is optionalUser because an open document accepts an anonymous
    // retitle. An owned one refuses every caller who is not its owner, private or
    // not, which is why resolvePrivateAccess is not consulted here any more.
    if (!isOpenDocument(existing) && !isDocumentOwner(existing, requesterId)) {
      throw new AppError('Only the document owner can change its metadata', 403, 'FORBIDDEN')
    }

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

    // On create the row does not exist yet, and the `ownerId` below decides it. An authed
    // creator may therefore set the locks in the same request. An open document may not.
    // With no owner, resolvePrivateAccess answers sign-in-required to everyone, so a flip
    // would seal the row against the world with nothing able to undo it.
    const ownerAfterWrite = existing ? existing.ownerId : (requesterId ?? null)
    const mayMutateAccess = ownerAfterWrite != null && ownerAfterWrite === requesterId

    const readOnlyChanged = readOnly !== undefined && (!existing || readOnly !== existing.readOnly)
    if (readOnlyChanged && mayMutateAccess) {
      updateData.readOnly = readOnly
    } else if (readOnlyChanged) {
      documentsServiceLogger.warn(
        { documentId, requesterId },
        'Ignored readOnly change on an open document'
      )
    }

    const privateChanged =
      isPrivate !== undefined && (!existing || isPrivate !== existing.isPrivate)
    if (privateChanged && mayMutateAccess) {
      updateData.isPrivate = isPrivate
    } else if (privateChanged) {
      documentsServiceLogger.warn(
        { documentId, requesterId },
        'Ignored isPrivate change on an open document'
      )
    }

    // Private on writes the mirror first, so a failed write leaves Prisma and the chat public.
    // A failed Prisma write after it leaves the mirror Private while Prisma is public or has no row,
    // so the chat stays closed.
    if (updateData.isPrivate === true) {
      await writeDocumentAccessMirror({ documentId, isPrivate: true, ownerId: ownerAfterWrite })
    }

    // Anchor a draft under its URL slug when this PUT creates the row; without a
    // slug, non-slug callers keep the prior slugify(title) behavior, unchanged.
    // Never enters updateData — the update branch must not rename an existing doc.
    const anchorSlug = slug || title
    const upsertedDoc = await prisma.documentMetadata.upsert({
      where: { documentId },
      update: updateData,
      create: {
        documentId,
        slug: anchorSlug ? normalizeSlug(anchorSlug) : documentId,
        title: title || documentId,
        description: description || '',
        keywords: keywords ? keywords.join(',') : '',
        ownerId: requesterId || null,
        ...updateData
      },
      select: PUBLIC_METADATA_SELECT
    })

    // A cached link card would show the title for 24 h after the pad turned Private.
    if (updateData.isPrivate === true) void forgetPadCards(upsertedDoc.slug)

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
      })
    }

    if (
      requesterId &&
      title !== undefined &&
      isPadTitleChange({
        existed: existing != null,
        storedTitle: existing?.title,
        nextTitle: title
      })
    ) {
      notifyPadTitleChange({
        documentId,
        actorId: requesterId,
        titleFrom: existing?.title ?? '',
        titleTo: title
      })
    }

    // Written even when the flag did not change, so a retry repairs a failed write.
    // It runs after the seal and the title notice, so a throw here loses neither.
    // A failed Private-off write leaves the chat closed.
    if (isPrivate !== undefined && mayMutateAccess) {
      await writeDocumentAccessMirror({
        documentId,
        isPrivate: upsertedDoc.isPrivate,
        ownerId: upsertedDoc.ownerId
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
    // A gate refusal is a 4xx decision, not a database failure: handlePrismaError
    // would relabel it a DatabaseError and the caller would answer 500.
    if (error instanceof AppError) throw error
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
    select: { ownerId: true, isPrivate: true, slug: true }
  })
  if (!isDocumentOwner(existing, requesterId)) return { authorized: false }

  // A partial purge may already have deleted the Private mirror row, and a missing row
  // opens the chat. So a Private restore writes the row first. A failed write keeps the
  // document in Trash.
  if (deletedAt === null && existing?.isPrivate) {
    await writeDocumentAccessMirror({ documentId, isPrivate: true, ownerId: existing.ownerId })
  }

  try {
    await prisma.documentMetadata.update({ where: { documentId }, data: { deletedAt } })
  } catch (error) {
    // P2025 = row already gone (reaper/race); soft-delete + restore are idempotent.
    if ((error as { code?: string }).code === 'P2025') return { authorized: true }
    documentsServiceLogger.error({ err: error, documentId }, 'Error toggling document deletedAt')
    throw handlePrismaError(error)
  }

  if (deletedAt !== null && existing) void forgetPadCards(existing.slug)

  // One publish covers soft delete and restore. Not on the P2025 path above —
  // nothing changed there.
  void publishDocumentAccessEvent({
    documentId,
    deleted: deletedAt !== null,
    ownerId: existing?.ownerId ?? null,
    timestamp: new Date().toISOString()
  })
  return { authorized: true }
}

export const softDeleteDocument = (
  prisma: PrismaClient,
  documentId: string,
  requesterId?: string
) => setDeletedAt(prisma, documentId, requesterId, new Date())

export const restoreDocument = (prisma: PrismaClient, documentId: string, requesterId?: string) =>
  setDeletedAt(prisma, documentId, requesterId, null)

export type SetFavoriteResult =
  | { status: 'ok'; documentId: string; isFavorite: boolean }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export const setDocumentFavorite = async (
  prisma: PrismaClient,
  documentId: string,
  requesterId: string | undefined,
  favorite: boolean
): Promise<SetFavoriteResult> => {
  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const existing = await prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { ownerId: true, deletedAt: true }
  })

  if (!existing || existing.deletedAt) return { status: 'not-found' }
  if (!requesterId || !isDocumentOwner(existing, requesterId)) return { status: 'forbidden' }

  try {
    if (favorite) {
      await prisma.documentFavorite.upsert({
        where: { documentId_userId: { documentId, userId: requesterId } },
        create: { documentId, userId: requesterId },
        update: {}
      })
    } else {
      await prisma.documentFavorite.deleteMany({
        where: { documentId, userId: requesterId }
      })
    }
  } catch (error) {
    documentsServiceLogger.error({ err: error, documentId }, 'Error setting document favorite')
    throw handlePrismaError(error)
  }

  return { status: 'ok', documentId, isFavorite: favorite }
}

export type TouchOpenedResult =
  { status: 'ok'; documentId: string } | { status: 'forbidden' } | { status: 'not-found' }

/** Sets `lastOpenedAt` only. Prisma `update` would stamp `@updatedAt` and rewrite Last modified. */
export const touchDocumentOpened = async (
  prisma: PrismaClient,
  documentId: string,
  requesterId?: string
): Promise<TouchOpenedResult> => {
  if (!documentId || documentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const existing = await prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { ownerId: true, deletedAt: true }
  })

  if (!isDocumentOwner(existing, requesterId)) return { status: 'forbidden' }
  if (!existing || existing.deletedAt) return { status: 'not-found' }

  await prisma.$executeRaw`
    UPDATE "DocumentMetadata"
    SET "lastOpenedAt" = NOW()
    WHERE "documentId" = ${documentId}
      AND "deletedAt" IS NULL
      AND ("lastOpenedAt" IS NULL OR "lastOpenedAt" < NOW() - INTERVAL '30 seconds')
  `
  return { status: 'ok', documentId }
}

export type PermanentDeleteResult =
  { status: 'forbidden' } | { status: 'not-deleted' } | { status: 'ok' }

// Immediate footprint purge for a soft-deleted doc (Trash "Delete forever"), sharing
// the reaper's purge. Refuses a live doc so it can't hard-delete an active one.
// Owner-checked before the deletedAt check, so state never leaks to a non-owner.
// A missing (already-purged) row resolves to ok (idempotent).
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
      slug: existing.slug,
      scope: { permanent: true }
    })
  } catch (error) {
    documentsServiceLogger.error({ err: error, documentId }, 'Error purging document footprint')
    throw handlePrismaError(error)
  }
  return { status: 'ok' }
}

// Bulk Trash purge. `ids` omitted → every soft-deleted doc the requester owns; each id
// reuses the single-doc purge, inheriting its owner gating and idempotency. Sequential on
// purpose — each purge fans out to storage and the Supabase footprint RPC. Synchronous, so
// a huge trash times out: move the loop to the worker, never cap it with a bare `take`.
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
