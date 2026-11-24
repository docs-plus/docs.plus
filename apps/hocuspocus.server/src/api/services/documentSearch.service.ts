import type { Prisma, PrismaClient } from '../../generated/prisma/client'
import {
  fillMissingDocumentPreviews,
  parseDocumentGridPreview
} from '../../lib/documentGridPreview'
import { handlePrismaError, ValidationError } from '../../lib/errors'
import { documentsServiceLogger } from '../../lib/logger'
import { getOwnerProfiles } from '../../lib/profiles'
import type { SearchDocumentsParams } from '../../types'
import { PUBLIC_METADATA_SELECT } from './documents.service'

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
          display_name: ownerProfile.display_name || ownerProfile.full_name
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
