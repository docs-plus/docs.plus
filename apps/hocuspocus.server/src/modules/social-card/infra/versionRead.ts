import type { PrismaClient } from '../../../generated/prisma/client'
import type { CardReads } from '../domain/resolveCard'
import { parseChangeSummary } from '../domain/storedData'

/**
 * The version row behind the Version card (#669). It never selects `data`, so the request
 * path decodes no snapshot. A thinned row or a summary not yet written reads null.
 */
export const createVersionRead =
  (prisma: PrismaClient): CardReads['version'] =>
  async (documentId, version) => {
    const row = await prisma.documents.findUnique({
      where: { Documents_documentId_version_unique: { documentId, version } },
      select: { createdAt: true, changeSummary: true }
    })
    const summary = row && parseChangeSummary(row.changeSummary)
    return summary ? { version, createdAt: row.createdAt, summary } : null
  }
