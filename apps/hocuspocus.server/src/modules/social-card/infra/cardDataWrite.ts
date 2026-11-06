import type { PrismaClient } from '../../../generated/prisma/client'
import { dbLogger } from '../../../lib/logger'
import { type CardDataWriteOutcome, socialCardDataWritesTotal } from '../../../lib/metrics'
import { cardDataFromPmJson } from '../domain/extract'

/**
 * Sets `cardData` only while `version` is still the head, so a late job never draws text a
 * newer save removed. `payload` null is the fail-closed write. Raw SQL, so no updatedAt.
 */
export const writeCardData = (
  prisma: PrismaClient,
  documentId: string,
  version: number,
  payload: string | null
): Promise<number> => prisma.$executeRaw`
  UPDATE "DocumentMetadata"
  SET "cardData" = CAST(${payload} AS jsonb)
  WHERE "documentId" = ${documentId}
    AND "cardData" IS DISTINCT FROM CAST(${payload} AS jsonb)
    AND (SELECT max(version) FROM "Documents" WHERE "documentId" = ${documentId}) = ${version}
`

const count = (outcome: CardDataWriteOutcome) => socialCardDataWritesTotal.inc({ outcome })

/**
 * The worker's card write after a save. `json` null is an undecodable head. Never throws: an
 * extract or write error stores NULL, so the card draws fewer details.
 */
export const refreshCardData = async (
  prisma: PrismaClient,
  args: { documentId: string; version: number; json: unknown }
): Promise<void> => {
  const { documentId, version, json } = args
  let payload: string | null = null
  try {
    if (json !== null) payload = JSON.stringify(cardDataFromPmJson(json))
  } catch (err) {
    dbLogger.warn({ err, documentId }, 'Failed to extract social card data')
  }
  try {
    const written = await writeCardData(prisma, documentId, version, payload)
    count(payload === null ? 'nulled' : written > 0 ? 'ok' : 'skipped')
  } catch (err) {
    dbLogger.warn({ err, documentId }, 'Failed to write social card data')
    await writeCardData(prisma, documentId, version, null).then(
      () => count('nulled'),
      () => count('failed')
    )
  }
}
