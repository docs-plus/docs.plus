import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { PrismaClient } from '@prisma/client'

import * as documentPurgeService from '../../src/api/services/documentPurge.service'
import { bulkDeleteStale } from '../../src/api/services/adminStaleDocuments.service'
import { config } from '../../src/config/env'

const SLUG = 'old-pad'

// One candidate that would score 100 with zero views, so a swallowed read
// failure would carry it into the purge.
const candidate = {
  slug: SLUG,
  document_id: 'DOC-1',
  title: 'Old pad',
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
  is_private: false,
  owner_id: null,
  owner_email: null,
  version_count: 1n,
  days_inactive: 100,
  age_days: 300
}

const prisma = {
  $queryRaw: async () => [candidate],
  documentMetadata: {
    findMany: async () => [{ slug: SLUG, title: 'Old pad', documentId: 'DOC-1' }]
  }
} as unknown as PrismaClient

const supabaseConfig = config.supabase as { url: string }
const originalUrl = supabaseConfig.url

describe('bulkDeleteStale when the view-stats read fails', () => {
  let purgeSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    purgeSpy = spyOn(documentPurgeService, 'purgeDocumentFootprint').mockResolvedValue({
      purged: 1
    })
  })

  afterEach(() => {
    purgeSpy.mockRestore()
    supabaseConfig.url = originalUrl
  })

  test('rejects on a 500 and purges nothing', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'boom' }), { status: 500 })
    )
    try {
      await expect(bulkDeleteStale(prisma, [SLUG], false)).rejects.toThrow('status 500')
      expect(purgeSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('rejects when the Supabase URL is unset and purges nothing', async () => {
    supabaseConfig.url = ''
    await expect(bulkDeleteStale(prisma, [SLUG], false)).rejects.toThrow('not set')
    expect(purgeSpy).not.toHaveBeenCalled()
  })
})

// 150 candidates need two view-stats reads. The viewed pad sits in the second
// read, so a dropped or failed second read would score it unviewed.
describe('bulkDeleteStale over more ids than one read carries', () => {
  const candidates = Array.from({ length: 150 }, (_, i) => ({
    ...candidate,
    slug: `pad-${i}`,
    document_id: `DOC-${i}`
  }))
  const VIEWED = candidates[120]
  const manyPrisma = {
    $queryRaw: async () => candidates,
    documentMetadata: {
      findMany: async ({ where }: { where: { slug: { in: string[] } } }) =>
        candidates
          .filter((c) => where.slug.in.includes(c.slug))
          .map((c) => ({ slug: c.slug, title: c.title, documentId: c.document_id }))
    }
  } as unknown as PrismaClient

  let purgeSpy: ReturnType<typeof spyOn>
  beforeEach(() => {
    purgeSpy = spyOn(documentPurgeService, 'purgeDocumentFootprint').mockResolvedValue({
      purged: 1
    })
  })
  afterEach(() => purgeSpy.mockRestore())

  test('reads in chunks and keeps the viewed pad from the second chunk', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
      const ids = decodeURIComponent(url)
        .match(/in\.\((.*)\)&/)![1]
        .split(',')
      expect(ids.length).toBeLessThanOrEqual(100)
      const rows = ids.includes(`"${VIEWED.document_id.toLowerCase()}"`)
        ? [{ document_slug: VIEWED.document_id.toLowerCase(), views_7d: 5, views_30d: 10 }]
        : []
      return new Response(JSON.stringify(rows), { status: 200 })
    }) as unknown as typeof fetch)
    try {
      const result = await bulkDeleteStale(manyPrisma, [VIEWED.slug], false)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(purgeSpy).not.toHaveBeenCalled()
      expect(result.failedDocuments).toEqual([
        { slug: VIEWED.slug, error: 'Document is not currently stale' }
      ])
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('rejects when only the second chunk fails and purges nothing', async () => {
    let call = 0
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response('[]', { status: ++call === 2 ? 414 : 200 })) as unknown as typeof fetch
    )
    try {
      await expect(bulkDeleteStale(manyPrisma, [candidates[0].slug], false)).rejects.toThrow(
        'status 414'
      )
      expect(purgeSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
