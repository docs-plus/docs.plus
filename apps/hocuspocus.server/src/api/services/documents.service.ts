import { Prisma, PrismaClient } from '@prisma/client'
import ShortUniqueId from 'short-unique-id'

import { publishDocumentAccessEvent } from '../../lib/accessRealtime'
import { writeDocumentAccessMirror } from '../../lib/documentAccessMirror'
import {
  fillMissingDocumentPreviews,
  parseDocumentGridPreview
} from '../../lib/documentGridPreview'
import { deriveDocumentId, INITIAL_EPOCH } from '../../lib/documentId'
import {
  AppError,
  handlePrismaError,
  InternalServerError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError
} from '../../lib/errors'
import { documentsServiceLogger } from '../../lib/logger'
import { isDocumentOwner, isOpenDocument } from '../../lib/ownerAccess'
import { isPadTitleChange, notifyPadTitleChange } from '../../lib/padTitleChange'
import { getOwnerProfile, getOwnerProfiles } from '../../lib/profiles'
import { rehostMediaUrls } from '../../lib/rehostMediaUrls'
import { normalizeSlug, withUniqueSlug } from '../../lib/slug'
import { getServiceRoleClient } from '../../lib/supabase'
import { MAX_DUPLICATE_MEDIA_OBJECTS } from '../../schemas/hypermultimedia.schema'
import type { CreateDocumentParams, SearchDocumentsParams, UpdateDocumentParams } from '../../types'
import { purgeDocumentFootprint } from './documentPurge.service'
import { copyDocumentMedia, deleteDocumentMedia } from './media.service'

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
// The create may carry the first signed-in editor as owner. P2002 = already anchored, or
// a concurrent first-open won the slug: we cede and never claim. True only on a create.
export const ensureDraftDocumentMetadata = async (
  prisma: PrismaClient,
  params: { documentId: string; slug: string; ownerId?: string | null; email?: string | null }
): Promise<boolean> => {
  const newSlug = normalizeSlug(params.slug)
  if (!newSlug) return false

  try {
    await prisma.documentMetadata.create({
      data: {
        documentId: params.documentId,
        slug: newSlug,
        title: newSlug,
        description: newSlug,
        keywords: '',
        ownerId: params.ownerId ?? null,
        email: params.email ?? null
      }
    })
    return true
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false
    throw err
  }
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

export const getDocumentBySlug = async (prisma: PrismaClient, slug: string) => {
  if (!slug || slug.trim().length === 0) {
    throw new ValidationError('Slug is required and cannot be empty')
  }

  try {
    const normalizedSlug = normalizeSlug(slug)

    const doc = await prisma.documentMetadata.findUnique({
      where: { slug: normalizedSlug },
      select: PUBLIC_METADATA_SELECT
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

const SORT_FIELD_MAP: Record<
  string,
  { field: 'updatedAt' | 'createdAt' | 'lastOpenedAt' | 'title'; dir: 'asc' | 'desc' }
> = {
  updatedAt_desc: { field: 'updatedAt', dir: 'desc' },
  createdAt_desc: { field: 'createdAt', dir: 'desc' },
  lastOpenedAt_desc: { field: 'lastOpenedAt', dir: 'desc' },
  title_asc: { field: 'title', dir: 'asc' },
  title_desc: { field: 'title', dir: 'desc' }
}

/** Create, slug GET, update, and the public fleet. Never `preview` or `lastOpenedAt`. */
const PUBLIC_METADATA_SELECT = {
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

const OWNER_LIST_SELECT = {
  ...PUBLIC_METADATA_SELECT,
  lastOpenedAt: true,
  preview: true
} as const

/**
 * Only the owner live list may sort by `lastOpenedAt`; elsewhere the order would leak it.
 * The Favorite pin is a tier in `findTieredPage`, never part of this order.
 */
function buildDocumentsOrderBy(args: {
  deleted?: boolean
  sort?: SearchDocumentsParams['sort']
  ownerLiveList?: boolean
}) {
  const requested = SORT_FIELD_MAP[args.sort ?? 'updatedAt_desc'] ?? SORT_FIELD_MAP.updatedAt_desc
  const { field, dir } =
    requested.field === 'lastOpenedAt' && !args.ownerLiveList
      ? SORT_FIELD_MAP.updatedAt_desc
      : requested
  return args.deleted
    ? { deletedAt: 'desc' as const }
    : field === 'lastOpenedAt'
      ? { lastOpenedAt: { sort: dir, nulls: 'last' as const } }
      : { [field]: dir }
}

type DocumentWhere = Prisma.DocumentMetadataWhereInput
type DocumentOrderBy =
  | Prisma.DocumentMetadataOrderByWithRelationInput
  | Prisma.DocumentMetadataOrderByWithRelationInput[]
type ListTier = { where: DocumentWhere; orderBy: DocumentOrderBy }

const notOwnedBy = (userId: string): DocumentWhere[] => [
  { ownerId: null },
  { ownerId: { not: userId } }
]

/**
 * Pins the caller's own Favorites, then the rest. Never `favorites: { _count }`: it counts
 * every user's stars, so a row starred only by someone else would pin with no star.
 */
function favoritePinTiers(
  where: DocumentWhere,
  userId: string,
  orderBy: DocumentOrderBy
): ListTier[] {
  const mine = { userId }
  const unpinned: DocumentWhere[] = [...notOwnedBy(userId), { favorites: { none: mine } }]
  return [
    { where: { AND: [where, { ownerId: userId }, { favorites: { some: mine } }] }, orderBy },
    { where: { AND: [where, { OR: unpinned }] }, orderBy }
  ]
}

/**
 * The `all` and `joined` scopes. A row the caller does not own must be public and live.
 * The tiers stand in for orderings Prisma cannot write: pin only the caller's own stars,
 * and sort a non-owned row as never opened. `ownerId: { not }` drops NULL, so say NULL too.
 */
function buildMemberScopeTiers(args: {
  scope: 'all' | 'joined'
  userId: string
  documentIds: string[]
  searchClauses: DocumentWhere[] | null
  sort?: SearchDocumentsParams['sort']
}): ListTier[] {
  const { userId, sort } = args
  const joinedArm: DocumentWhere = {
    documentId: { in: args.documentIds },
    isPrivate: false,
    deletedAt: null
  }
  const notOwned = notOwnedBy(userId)
  const scopeWhere: DocumentWhere =
    args.scope === 'all'
      ? { OR: [{ ownerId: userId, deletedAt: null }, joinedArm] }
      : { AND: [joinedArm, { OR: notOwned }] }
  const where = (...more: DocumentWhere[]): DocumentWhere => ({
    AND: [...(args.searchClauses ? [{ OR: args.searchClauses }] : []), scopeWhere, ...more]
  })

  const orderBy = buildDocumentsOrderBy({ sort, ownerLiveList: false })
  if (args.scope === 'joined') return [{ where: where(), orderBy }]

  if (sort !== 'lastOpenedAt_desc') return favoritePinTiers(where(), userId, orderBy)

  const mine = { userId }
  return [
    {
      where: where({ ownerId: userId }, { favorites: { some: mine } }),
      orderBy: { lastOpenedAt: { sort: 'desc', nulls: 'last' } }
    },
    {
      where: where(
        { ownerId: userId },
        { favorites: { none: mine } },
        { lastOpenedAt: { not: null } }
      ),
      orderBy: { lastOpenedAt: 'desc' }
    },
    {
      where: where({ OR: [...notOwned, { favorites: { none: mine }, lastOpenedAt: null }] }),
      orderBy
    }
  ]
}

/** One offset page across ordered tiers; `total` is the sum of the tier counts. */
async function findTieredPage<S extends Prisma.DocumentMetadataSelect>(
  prisma: PrismaClient,
  tiers: ListTier[],
  select: S,
  offset: number,
  limit: number
) {
  const counts = await Promise.all(
    tiers.map((tier) => prisma.documentMetadata.count({ where: tier.where }))
  )
  const docs: Prisma.DocumentMetadataGetPayload<{ select: S }>[] = []
  let skip = offset
  for (const [index, tier] of tiers.entries()) {
    if (docs.length >= limit) break
    if (skip >= counts[index]) {
      skip -= counts[index]
      continue
    }
    const page = await prisma.documentMetadata.findMany({
      where: tier.where,
      orderBy: tier.orderBy,
      select,
      skip,
      take: limit - docs.length
    })
    docs.push(...(page as Prisma.DocumentMetadataGetPayload<{ select: S }>[]))
    skip = 0
  }
  return [docs, counts.reduce((sum, count) => sum + count, 0)] as const
}

export const searchDocuments = async (prisma: PrismaClient, params: SearchDocumentsParams) => {
  const {
    title,
    keywords: reqKeywords,
    description,
    ownerId,
    requesterId,
    deleted,
    sort,
    membership,
    limit,
    offset
  } = params

  if (limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be between 1 and 100')
  }

  if (offset < 0) {
    throw new ValidationError('Offset must be non-negative')
  }

  try {
    let docs
    let total

    // Live lists hide soft-deleted rows until the reaper purges them; the Trash
    // view inverts that to show only the caller's tombstoned docs.
    const deletedWhere = deleted ? { deletedAt: { not: null } } : { deletedAt: null }

    // AND `ownerId` onto any existing WHERE so the search and owner filter compose.
    const ownerWhere = ownerId ? { ownerId } : undefined

    // Fleet clamp: an unverified caller or an owner-less list must not enumerate
    // private rows. Owner-scoped calls (ownerId === token.sub) are unaffected.
    const privacyWhere = !requesterId || !ownerId ? { isPrivate: false } : {}

    const ownerLiveList = Boolean(requesterId && ownerId && requesterId === ownerId && !deleted)
    const ownerTrashList = Boolean(requesterId && ownerId && requesterId === ownerId && deleted)
    const ownerPreviewList = ownerLiveList || ownerTrashList
    const orderBy = buildDocumentsOrderBy({ deleted, sort, ownerLiveList })
    const ownerFavoritesSelect = {
      ...OWNER_LIST_SELECT,
      favorites: { where: { userId: requesterId }, select: { userId: true } }
    }
    const listSelect = ownerLiveList
      ? ownerFavoritesSelect
      : ownerTrashList
        ? OWNER_LIST_SELECT
        : PUBLIC_METADATA_SELECT

    let searchClauses: Prisma.DocumentMetadataWhereInput[] | null = null
    if (title || reqKeywords || description) {
      // to_tsquery (the `search` clauses) throws a 500 on operator punctuation
      // like `C++` or `foo)`. Reduce each token to bare word characters, so bad
      // input returns no matches instead of crashing the endpoint.
      const searchTokens = [
        ...(title ? decodeURIComponent(title).split(' ') : []),
        ...(reqKeywords ? decodeURIComponent(reqKeywords).split(' ') : []),
        ...(description ? decodeURIComponent(description).split(' ') : [])
      ]
        .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
        .filter((x) => x && x !== 'undefined')

      const searchQuery = searchTokens.join(' & ')
      searchClauses = [
        { title: { contains: searchQuery } },
        { title: { search: searchQuery } },
        { keywords: { search: searchQuery } },
        { description: { search: searchQuery } }
      ]
    }

    if (membership) {
      // The controller reads `membership` from token.sub, so it never comes without one.
      if (!requesterId) throw new Error('A membership list needs requesterId')
      if (membership.scope === 'joined' && membership.documentIds.length === 0) {
        return { docs: [], total: 0 }
      }
      const tiers = buildMemberScopeTiers({
        ...membership,
        userId: requesterId,
        searchClauses,
        sort
      })
      const memberSelect =
        membership.scope === 'all'
          ? ownerFavoritesSelect
          : { ...PUBLIC_METADATA_SELECT, preview: true as const }
      ;[docs, total] = await findTieredPage(prisma, tiers, memberSelect, offset, limit)
    } else {
      const baseWhere: Prisma.DocumentMetadataWhereInput = {
        ...(searchClauses ? { OR: searchClauses } : {}),
        ...(ownerWhere ?? {}),
        ...privacyWhere,
        ...deletedWhere
      }

      if (ownerLiveList && requesterId) {
        const tiers = favoritePinTiers(baseWhere, requesterId, orderBy)
        ;[docs, total] = await findTieredPage(prisma, tiers, listSelect, offset, limit)
      } else {
        ;[docs, total] = await Promise.all([
          prisma.documentMetadata.findMany({
            skip: offset,
            take: limit,
            where: baseWhere,
            select: listSelect,
            orderBy
          }),
          prisma.documentMetadata.count({ where: baseWhere })
        ])
      }
    }

    const previewList = ownerPreviewList || Boolean(membership)
    const listed = docs.map((doc) => {
      const {
        favorites,
        keywords,
        preview: rawPreview,
        ...rest
      } = doc as typeof doc & {
        favorites?: { userId: string }[]
        preview?: unknown
        lastOpenedAt?: Date | null
      }
      const isOwner = Boolean(requesterId) && rest.ownerId === requesterId
      // A row the caller does not own never carries the owner's open stamp.
      if (membership && !isOwner) delete rest.lastOpenedAt
      return {
        ...rest,
        isOwner,
        ...(ownerLiveList || (membership && isOwner)
          ? { isFavorite: (favorites?.length ?? 0) > 0 }
          : {}),
        ...(previewList ? { preview: parseDocumentGridPreview(rawPreview) } : {}),
        keywords: keywords
          ? keywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
          : []
      }
    })

    // Every listed row is one the caller may read, so the fill never writes past that.
    const filled = previewList
      ? await fillMissingDocumentPreviews(
          prisma,
          listed.filter((doc) => doc.preview == null).map((doc) => doc.documentId)
        )
      : new Map()

    const formattedDocs = listed.map((doc) => {
      const next = filled.get(doc.documentId)
      return next ? { ...doc, preview: next } : doc
    })

    const ownerIds = formattedDocs.filter((doc) => doc.ownerId).map((doc) => doc.ownerId!)
    const ownerProfiles = await getOwnerProfiles(ownerIds)

    const docsWithOwners = formattedDocs.map((doc) => {
      if (!doc.ownerId) return doc

      const ownerProfile = ownerProfiles.find((profile) => profile.id === doc.ownerId)
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
      ownerId?: string
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
    select: { ownerId: true, isPrivate: true }
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

export type DuplicateDocumentResult =
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'ok'; document: { documentId: string; slug: string; title: string } }

// Strict-owner duplicate of the source's latest Yjs bytes — no history rebuild.
// Media is RE-HOSTED, not shared. The snapshot is scanned first, then exactly the
// objects it names are cloned under the copy's own prefix and its URLs repointed
// there. FORWARD-ONLY — copies made before this still share their source's objects.
export const duplicateDocument = async (
  prisma: PrismaClient,
  sourceDocumentId: string,
  requesterId?: string,
  email?: string | null
): Promise<DuplicateDocumentResult> => {
  if (!sourceDocumentId || sourceDocumentId.trim().length === 0) {
    throw new ValidationError('Document ID is required and cannot be empty')
  }

  const source = await prisma.documentMetadata.findUnique({
    where: { documentId: sourceDocumentId },
    select: { ownerId: true, title: true, description: true, keywords: true, deletedAt: true }
  })

  // Owner-gate first (a missing source is also non-owner → 403, mirroring
  // delete/restore), then the soft-delete seal (404, consistent with reads).
  if (!isDocumentOwner(source, requesterId)) return { status: 'forbidden' }
  if (source?.deletedAt) return { status: 'not-found' }

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
    const rehosted = bytes ? rehostMediaUrls(bytes, documentId) : null
    if (rehosted?.data) {
      // Refused before a single object is written, so nothing needs rolling back.
      if (rehosted.references.length > MAX_DUPLICATE_MEDIA_OBJECTS) {
        throw new PayloadTooLargeError(
          `This document references ${rehosted.references.length} media objects, ` +
            `over the ${MAX_DUPLICATE_MEDIA_OBJECTS} a duplicate may copy`
        )
      }
      try {
        await copyDocumentMedia(rehosted.references, documentId)
      } catch (error) {
        // An object-store outage is not a database fault; keep it out of
        // `handlePrismaError`, which would group it as a DatabaseError.
        throw error instanceof AppError
          ? error
          : new InternalServerError("Failed to copy the source document's media")
      }
      bytes = rehosted.data
    }

    const title = `${source?.title ?? ''} (copy)`.trim()
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
            description: source?.description ?? '',
            documentId,
            keywords: source?.keywords ?? '',
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
