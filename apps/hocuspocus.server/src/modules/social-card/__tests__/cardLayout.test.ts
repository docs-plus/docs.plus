import { describe, expect, it } from 'bun:test'

import type { CardQuery } from '../domain/cardRequest'
import { attachCard } from '../module'
import { pickRows, resolveDocument } from '../domain/kinds/document'
import { matchFilter } from '../domain/kinds/filter'
import { topReaction } from '../domain/kinds/message'
import type { CardSource } from '../domain/kinds/types'
import { type CardReads, resolveCard } from '../domain/resolveCard'
import type { StoredBlock, StoredOutlineItem } from '../domain/storedData'

const item = (id: string, level: number, parent: number, text = id): StoredOutlineItem => ({
  id,
  level,
  text,
  parent,
  blocks: []
})
const drawable = () => true

describe('pickRows', () => {
  it('draws the top level alone when it has 3 rows', () => {
    const items = [item('a', 1, -1), item('a1', 2, 0), item('b', 1, -1), item('c', 1, -1)]
    expect(pickRows(items, drawable)).toEqual([
      { text: 'a', depth: 0 },
      { text: 'b', depth: 0 },
      { text: 'c', depth: 0 }
    ])
  })

  it('nests the children of a short top level under it', () => {
    const items = [item('a', 1, -1), item('a1', 2, 0), item('a1x', 3, 1), item('b', 1, -1)]
    expect(pickRows(items, drawable)).toEqual([
      { text: 'a', depth: 0 },
      { text: 'a1', depth: 1 },
      { text: 'b', depth: 0 }
    ])
  })
})

describe('resolveDocument', () => {
  const source = (items: StoredOutlineItem[], blocks: StoredBlock[] | null): CardSource => ({
    padTitle: 'Field notes',
    padName: 'Field notes',
    blocks,
    outline: { title: null, titleId: null, items },
    query: {},
    facts: { chat: null, version: null },
    isDrawable: drawable
  })
  const paragraph: StoredBlock = { kind: 'paragraph', text: 'We walked the north trail at dawn.' }
  const tag = async (s: CardSource) => (await resolveDocument(s))?.values[0]

  it('draws outline rows from 3 rows up', async () => {
    const items = [item('a', 1, -1), item('b', 1, -1), item('c', 1, -1)]
    expect(await tag(source(items, [paragraph]))).toBe('document-outline')
  })

  it('draws the first blocks below 3 rows, else the title alone', async () => {
    const items = [item('a', 1, -1), item('b', 1, -1)]
    expect(await tag(source(items, [paragraph]))).toBe('document-blocks')
    expect(await tag(source(items, null))).toBe('document-title')
    // A line of only a link means nothing on a card.
    expect(await tag(source([], [{ kind: 'paragraph', text: 'https://docs.plus/x' }]))).toBe(
      'document-title'
    )
  })
})

describe('matchFilter', () => {
  const items = [item('a', 1, -1, 'Q4 launch plan'), item('b', 1, -1, 'Launch risks')]

  it('draws the stored text a term matched, folded, never the URL term', () => {
    expect(matchFilter(items, ['Q4-LAUNCH'], 'or', drawable)).toEqual({
      chips: ['q4-launch'],
      hits: [{ text: 'Q4 launch plan', level: 1 }]
    })
  })

  it('draws no chip for a term with no stored match', () => {
    const match = matchFilter(items, ['your-account-is-closed'], 'or', drawable)
    expect(match).toEqual({ chips: [], hits: [] })
  })

  it('draws the whole stored word, never a fragment cut from inside it', () => {
    const notes = [item('a', 1, -1, 'Therapist notes')]
    expect(matchFilter(notes, ['rapist'], 'or', drawable).chips).toEqual(['therapist'])
  })

  it('needs every term in Match all, any term in Match any', () => {
    expect(matchFilter(items, ['launch', 'risks'], 'and', drawable).hits).toEqual([
      { text: 'Launch risks', level: 1 }
    ])
    expect(matchFilter(items, ['q4', 'risks'], 'or', drawable).hits).toHaveLength(2)
  })
})

describe('topReaction', () => {
  it('draws one whole emoji only, never free text or a person', () => {
    expect(topReaction({ 'FREE BTC': 9, '👍': 2 }, drawable)).toEqual(['👍', 2])
    expect(topReaction({ 'scamsite.io': 9, '👍x': 8, '👍👍': 7, '🎉': 1 }, drawable)).toEqual([
      '🎉',
      1
    ])
    expect(topReaction({ '👩': 9, '🏃': 8, '👍🏽': 7 }, drawable)).toBeNull()
  })
})

describe('resolveCard', () => {
  const row = {
    documentId: 'doc1',
    title: 'Field notes',
    isPrivate: false,
    ownerId: 'u1',
    deletedAt: null,
    slug: 'field-notes',
    cardData: null
  }
  const reads = (chat: Awaited<ReturnType<CardReads['chat']>>): CardReads => ({
    chat: async () => chat,
    version: async () => null
  })
  const resolve = (query: CardQuery, chat: Awaited<ReturnType<CardReads['chat']>> = null) =>
    resolveCard({
      row,
      query,
      kinds: new Set(['document', 'chat']),
      reads: reads(chat),
      isDrawable: drawable
    })

  it('refuses a Private pad, and is off when no asked kind is on', async () => {
    expect(
      await resolveCard({
        row: { ...row, isPrivate: true },
        query: {},
        kinds: new Set(['document']),
        reads: reads(null),
        isDrawable: drawable
      })
    ).toEqual({ status: 'refused' })
    expect(
      (
        await resolveCard({
          row,
          query: {},
          kinds: new Set(['chat']),
          reads: reads(null),
          isDrawable: drawable
        })
      ).status
    ).toBe('off')
  })

  it('falls back to the Document card on a definite miss, not on a failed read', async () => {
    const missing = await resolve({ c: 'room' }, null)
    expect(missing.status === 'ok' && missing.card.kind).toBe('document')
    const shed = await resolve({ c: 'room' }, 'shed')
    expect(shed).toMatchObject({ status: 'unavailable', reason: 'shed' })
    expect(shed.status === 'unavailable' && shed.documentCard?.kind).toBe('document')
    expect(await resolve({ c: 'room' }, 'unavailable')).toMatchObject({
      status: 'unavailable',
      reason: 'unavailable'
    })
  })
})

describe('attachCard', () => {
  // Hono's request reads `this`, so a reader passed unbound throws and the card goes missing.
  class Req {
    constructor(private readonly params: Record<string, string>) {}
    query(key: string) {
      return this.params[key]
    }
    queries(key: string) {
      return this.params[key] ? [this.params[key]] : undefined
    }
  }
  const doc = {
    documentId: 'doc1',
    title: 'Field notes',
    isPrivate: false,
    ownerId: 'u1',
    deletedAt: null,
    slug: 'field-notes',
    cardData: null
  }

  it('adds the card only when asked, and never returns the stored card data', async () => {
    const kinds = new Set(['document'] as const)
    const req = new Req({ card: '1' })
    const asked = await attachCard({ prisma: {} as never, doc, req, kinds, withCard: true })
    expect(asked.card?.path).toBe('/field-notes')
    expect('cardData' in asked).toBe(false)
    const plain = await attachCard({
      prisma: {} as never,
      doc,
      req: new Req({}),
      kinds,
      withCard: false
    })
    expect(plain.card).toBeUndefined()
  })
})
