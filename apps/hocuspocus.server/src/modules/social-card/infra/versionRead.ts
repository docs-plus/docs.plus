import type { PrismaClient } from '../../../generated/prisma/client'
import type { CardReads } from '../domain/resolveCard'
import { parseChangeSummary } from '../domain/storedData'

/**
 * One version row without `data`, so the request path decodes no snapshot. The Version card
 * and the hovercard's version reply both read it. A thinned row reads null.
 */
export const readVersionRow = (prisma: PrismaClient, documentId: string, version: number) =>
  prisma.documents.findUnique({
    where: { Documents_documentId_version_unique: { documentId, version } },
    select: { createdAt: true, commitMessage: true, changeSummary: true }
  })

/** The Version card's read (#669). A summary not yet written reads null. */
export const createVersionRead =
  (prisma: PrismaClient): CardReads['version'] =>
  async (documentId, version) => {
    const row = await readVersionRow(prisma, documentId, version)
    const summary = row && parseChangeSummary(row.changeSummary)
    return summary ? { createdAt: row.createdAt, summary } : null
  }
