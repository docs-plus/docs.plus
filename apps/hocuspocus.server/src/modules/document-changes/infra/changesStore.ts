import type { PrismaClient } from '@prisma/client'

import type { ChangesStore } from '../types'

/**
 * Projection-only apart from `fetchPairBytes`, the one reader of `data`. The
 * `version` tiebreak is load-bearing: a P2002-healed retry mints two rows inside
 * the same second, and `createdAt` alone would pick an arbitrary one of them.
 */
export const createChangesStore = (prisma: PrismaClient): ChangesStore => ({
  findMeta: (documentId) =>
    prisma.documentMetadata.findUnique({
      where: { documentId },
      select: { deletedAt: true }
    }),

  resolveAnchor: (documentId, at) =>
    prisma.documents.findFirst({
      where: { documentId, createdAt: { lte: at } },
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      select: { id: true, version: true, createdAt: true }
    }),

  fetchWindow: (documentId, afterVersion, toVersion) =>
    prisma.documents.findMany({
      where: { documentId, version: { gt: afterVersion, lte: toVersion } },
      select: { trigger: true, triggeredBy: true, contributors: true }
    }),

  fetchPairBytes: (ids) =>
    prisma.documents.findMany({
      where: { id: { in: ids } },
      select: { id: true, data: true }
    })
})
