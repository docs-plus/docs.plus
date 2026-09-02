import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'

import { createComputeDocumentChanges } from '../../domain/computeDocumentChanges'

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {} } as unknown as Logger

const compute = createComputeDocumentChanges({
  prisma: {
    documentMetadata: { findUnique: async () => ({ deletedAt: null }) },
    documents: { findFirst: async () => null, findMany: async () => [] }
  } as unknown as PrismaClient,
  logger: silentLogger,
  getOwnerProfiles: async () => []
})

const request = {
  documentId: 'abcdefghij123456789',
  since: new Date(0),
  until: new Date(),
  scope: 'summary' as const
}

const summaryOf = async () => {
  const outcome = await compute(request)
  if (!outcome.ok) throw new Error(`expected a result, got ${outcome.reason}`)
  return outcome.result.summary
}

describe('createComputeDocumentChanges', () => {
  test('gives each call its own summary arrays', () => {
    // The digest worker imports this factory directly and maps the contributor
    // list in place. A shared module-level constant would let one document's
    // contributors reach every later document in the same process. The route
    // cannot show this, because serialising the response copies the arrays.
    return summaryOf().then(async (first) => {
      first.triggers.push('poisoned')
      first.contributors.push({
        id: 'leaked',
        avatar_url: null,
        avatar_updated_at: null,
        full_name: null,
        display_name: null,
        status: null
      })
      const second = await summaryOf()
      expect(second.triggers).toEqual([])
      expect(second.contributors).toEqual([])
    })
  })
})
