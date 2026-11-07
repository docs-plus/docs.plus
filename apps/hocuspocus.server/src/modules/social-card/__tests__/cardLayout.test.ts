import { describe, expect, it, mock } from 'bun:test'

import type { CardQuery } from '../domain/cardRequest'
import { attachCard } from '../module'
import { pickRows, resolveDocument } from '../domain/kinds/document'
import { matchFilter } from '../domain/kinds/filter'
import { topReaction } from '../domain/kinds/message'
import type { CardSource } from '../domain/kinds/types'
import { type CardReads, type CardSourceRow, resolveCard } from '../domain/resolveCard'
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
  const source = (
    members: number | null,
    blocks: StoredBlock[] | null,
    items: StoredOutlineItem[] | null
  ): CardSource => ({
    padName: 'Field notes',
    renamed: false,
    blocks,
    outline: items ? { title: null, titleId: null, items } : null,
    query: {},
    facts: { chat: null, version: null, members },
    isDrawable: drawable
  })
  const p = (text: string): StoredBlock => ({ kind: 'paragraph', text })
  const top = (n: number) =>
    Array.from({ length: n }, (_, i) => item(`s${i}`, 1, -1, `Section ${i + 1}`))
  const blocks = [p('We walked the north trail at dawn.'), p('Then we ate.')]

  it('draws the people count from 3 people, and says so in og:description', async () => {
    const card = await resolveDocument(source(15, blocks, top(5)))
    expect(card?.values[1]).toBe('We walked the north trail at dawn.')
    expect(card?.values[3]).toBe('15 people joined')
    expect(card?.ogDescription).toBe(
      '15 people are working on this document. 5 sections, with chat on each one.'
    )
  })

  it('puts the section names in the middle when people show and no paragraph does', async () => {
    const card = await resolveDocument(source(15, null, top(5)))
    expect(card?.values.slice(1)).toEqual([
      '',
      'Section 1 · Section 2 · Section 3 · +2 more',
      '15 people joined'
    ])
    expect(card?.alt).toBe('Field notes. Section 1 · Section 2 · Section 3 · +2 more.')
  })

  it('says "with its own chat" for one section, and leaves out zero sections', async () => {
    expect((await resolveDocument(source(15, blocks, top(1))))?.ogDescription).toBe(
      '15 people are working on this document. 1 section, with its own chat.'
    )
    expect((await resolveDocument(source(15, blocks, [])))?.ogDescription).toBe(
      '15 people are working on this document.'
    )
  })

  it('hides the count below 3 people, and names 3 sections then the rest', async () => {
    const card = await resolveDocument(source(2, blocks, top(5)))
    expect(card?.values[3]).toBe('')
    expect(card?.values[2]).toBe('Section 1 · Section 2 · Section 3 · +2 more')
    expect(card?.ogDescription).toBe('A document on docs.plus with 5 sections.')
  })

  it('claims no false section count when the stored outline was truncated', async () => {
    const truncated = {
      ...source(15, blocks, null),
      outline: { title: null, titleId: null, truncated: true as const, items: top(200) }
    }
    const card = await resolveDocument(truncated)
    expect(card?.ogDescription).toBe(
      '15 people are working on this document. 200+ sections, with chat on each one.'
    )
    expect(card?.values[2]).toBe('Section 1 · Section 2 · Section 3 · + more')
  })

  it('skips a first block that repeats the name, in any case', async () => {
    const card = await resolveDocument(source(null, [p('field notes'), p('Second block')], null))
    expect(card?.values[1]).toBe('Second block')
  })

  it('never prints the name twice when a section is named like the pad', async () => {
    const card = await resolveDocument(source(null, null, [item('s0', 1, -1, 'field Notes')]))
    expect(card?.values).toEqual(['Field notes', '', '', ''])
    expect(card?.alt).toBe('Field notes.')
  })

  it('draws the name alone, with no og:description, when it has nothing else', async () => {
    const card = await resolveDocument(source(null, null, null))
    expect(card?.values).toEqual(['Field notes', '', '', ''])
    expect(card?.ogDescription).toBeNull()
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
    version: async () => null,
    members: async () => null
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

  it('reads members only for an eligible row, once, when the Document card is on', async () => {
    const withMembers = (r: CardSourceRow, query: CardQuery = {}) => {
      const members = mock(async () => 15)
      const result = resolveCard({
        row: r,
        query,
        kinds: new Set(['document']),
        reads: { ...reads(null), members },
        isDrawable: drawable
      })
      return { members, result }
    }
    for (const refused of [
      { ...row, isPrivate: true },
      { ...row, ownerId: null },
      { ...row, deletedAt: new Date() }
    ]) {
      const { members, result } = withMembers(refused)
      expect(await result).toEqual({ status: 'refused' })
      expect(members).toHaveBeenCalledTimes(0)
    }
    const { members, result } = withMembers(row, { id: 'h1' })
    const heading = await result
    expect(heading.status === 'ok' && heading.card.kind).toBe('document')
    expect(members).toHaveBeenCalledTimes(1)
    expect(members).toHaveBeenCalledWith('doc1')
  })

  it('draws the people count on a heading link that falls back to the Document card', async () => {
    const result = await resolveCard({
      row,
      query: { id: 'h1' },
      kinds: new Set(['document']),
      reads: { ...reads(null), members: async () => 15 },
      isDrawable: drawable
    })
    expect(result.status === 'ok' && result.card.values).toContain('15 people joined')
  })

  describe('og:title name rule', () => {
    const ogTitle = async (title: string, slug: string, query: CardQuery = {}) => {
      const result = await resolveCard({
        row: {
          ...row,
          title,
          slug,
          cardData: {
            v: 1,
            blocks: [],
            outline: { title: 'House London', titleId: 't0', items: [item('h1', 1, -1, 'Venues')] }
          }
        },
        query,
        kinds: new Set(['document', 'heading']),
        reads: reads(null),
        isDrawable: drawable
      })
      return result.status === 'ok' ? result.card.ogTitle : 'not ok'
    }

    it('names a link-only Pad title by its Title heading', async () => {
      expect(await ogTitle('docs.plus/house-london', 'house-london')).toBe('House London')
      expect(await ogTitle('docs.plus/house-london', 'house-london', { id: 'h1' })).toBe(
        'Venues — House London'
      )
    })

    it('names a Pad title equal to the slug by its Title heading', async () => {
      expect(await ogTitle('house-london', 'house-london')).toBe('House London')
    })

    it('keeps the raw Pad title when it holds a link among words', async () => {
      expect(await ogTitle('Notes for https://x.com/a', 'notes')).toBeNull()
    })
  })
})

describe('attachCard', () => {
  // `tests/setup.ts` sets a service-role key, so the real read would call Supabase.
  mock.module('../infra/membersRead', () => ({ createMembersRead: () => async () => null }))
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
