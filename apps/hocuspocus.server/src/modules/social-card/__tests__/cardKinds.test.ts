import { describe, expect, it } from 'bun:test'

import type { CardQuery } from '../domain/cardRequest'
import { resolveChat } from '../domain/kinds/chat'
import { resolveFilter } from '../domain/kinds/filter'
import { resolveHeading } from '../domain/kinds/heading'
import { resolveMessage } from '../domain/kinds/message'
import type { CardFacts, CardSource, ChatFacts } from '../domain/kinds/types'
import { resolveVersion } from '../domain/kinds/version'
import { type CardReads, resolveCard } from '../domain/resolveCard'
import type { StoredBlock, StoredChangeSummary, StoredOutlineItem } from '../domain/storedData'
import { footLeftWidth } from '../render/fit'
import { T } from '../render/frame'
import { chipWidth, fitChips } from '../render/parts'

const drawable = () => true
const NO_FACTS: CardFacts = { chat: null, version: null, members: null }

const item = (id: string, text: string, blocks: StoredBlock[] = []): StoredOutlineItem => ({
  id,
  level: 1,
  text,
  parent: -1,
  blocks
})
const items = [
  item('h1', '🧰 Resources', [
    { kind: 'paragraph', text: '🧰 Resources' },
    { kind: 'paragraph', text: 'Slides, starter kits and the links you need for the day.' }
  ]),
  item('h2', '🏆 Winners'),
  item('h3', 'Prize rules'),
  item('h4', 'Judges')
]

const source = (query: CardQuery, facts: Partial<CardFacts> = {}): CardSource => ({
  padName: 'House London',
  renamed: false,
  blocks: null,
  outline: { title: 'House London', titleId: 't0', items },
  query,
  facts: { ...NO_FACTS, ...facts },
  isDrawable: drawable
})
const room = (count: number, message: ChatFacts['message'] = null): ChatFacts => ({
  headingId: 'h1',
  count,
  message
})

describe('resolveHeading', () => {
  it('draws the heading, its first line that is not the heading, and its chat count', async () => {
    const card = await resolveHeading(source({ id: 'h1' }, { chat: room(3) }))
    expect(card?.values).toEqual([
      'House London',
      '🧰 Resources',
      'Slides, starter kits and the links you need for the day.',
      '💬 3 messages'
    ])
    expect(card?.ogDescription).toBe('A section of House London, with its own chat.')
  })

  it("draws no count from another room's read", async () => {
    const other = { ...room(3), headingId: 'h2' }
    expect((await resolveHeading(source({ id: 'h1' }, { chat: other })))?.values[3]).toBe('')
  })
})

describe('resolveChat', () => {
  it('draws the room name and the bucketed count', async () => {
    const card = await resolveChat(source({ c: 'h1' }, { chat: room(12) }))
    expect(card?.values).toEqual(['House London', '🧰 Resources', '💬 10+ messages'])
    expect(card?.ogDescription).toBe('A conversation on a section of House London. 10+ messages.')
  })

  it('says "1 message" for one', async () => {
    const card = await resolveChat(source({ c: 'h1' }, { chat: room(1) }))
    expect(card?.values[2]).toBe('💬 1 message')
    expect(card?.ogDescription).toBe('A conversation on a section of House London. 1 message.')
  })
})

describe('resolveMessage', () => {
  const message = (replies: number) => ({
    createdAt: new Date('2026-11-06T10:00:00Z'),
    type: 'text',
    reactions: { '👍': 5 },
    replies
  })

  it('draws the top reaction and the reply count, never the text', async () => {
    const card = await resolveMessage(source({ c: 'h1', m: 'x' }, { chat: room(3, message(2)) }))
    expect(card?.values).toEqual(['House London', '🧰 Resources', '👍 5', '2 replies'])
    expect(card?.ogDescription).toBe('A message from the House London chat.')
  })

  it('says "1 reply" for one', async () => {
    const card = await resolveMessage(source({ c: 'h1', m: 'x' }, { chat: room(3, message(1)) }))
    expect(card?.values[3]).toBe('1 reply')
  })
})

describe('resolveFilter', () => {
  it('says "1 matching section" for one match', async () => {
    const card = await resolveFilter(source({ t: ['winners'] }))
    expect(card?.values).toEqual(['House London', 'winners', '🏆 Winners', '1 matching section'])
    expect(card?.ogTitle).toBe('House London')
    expect(card?.ogDescription).toBe('1 section of House London matches "winners".')
  })

  it('shows 3 term chips, then "+N"', async () => {
    const card = await resolveFilter(source({ t: ['resources', 'winners', 'prize', 'judges'] }))
    expect(card?.values.slice(0, 5)).toEqual([
      'House London',
      'resources',
      'winners',
      'prize',
      '+1'
    ])
    expect(card?.values.at(-1)).toBe('4 matching sections')
    expect(card?.ogDescription).toBe(
      '4 sections of House London match "resources, winners, prize, judges".'
    )
  })
})

describe('resolveVersion', () => {
  const summary: StoredChangeSummary = {
    v: 1,
    title: null,
    wordsAdded: 120,
    wordsRemoved: 0,
    sectionsAdded: 0,
    sectionsModified: 3,
    sectionsRemoved: 0,
    sectionsMoved: 0
  }

  it('draws the date, the pad name and one stat per change', async () => {
    const version = { createdAt: new Date('2026-11-06T10:00:00Z'), summary }
    const card = await resolveVersion(source({ version: 2 }, { version }))
    expect(card?.values).toEqual([
      'Version from 6 Nov 2026',
      'House London',
      '+120 words',
      '3 sections changed'
    ])
    expect(card?.ogDescription).toBe('A saved version of House London from 6 Nov 2026.')
  })
})

describe('fitChips', () => {
  it('leaves a chip out whole when the row is too narrow, never clipped', async () => {
    const facts = ['+1,234 −567 words', '4 sections added', 'changed 12', 'removed 2', 'moved 3']
    const room = await footLeftWidth('See what changed →')
    const kept = await fitChips(facts, room)
    expect(kept).toEqual(facts.slice(0, kept.length))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(facts.length)
    const widths = await Promise.all(kept.map(chipWidth))
    const next = await chipWidth(facts[kept.length])
    const used = widths.reduce((a, b) => a + b, 0) + (kept.length - 1) * T.chip.gap
    expect(used).toBeLessThanOrEqual(room)
    expect(used + T.chip.gap + next).toBeGreaterThan(room)
  })
})

describe('resolveCard heading chat read', () => {
  const row = {
    documentId: 'doc1',
    title: 'House London',
    isPrivate: false,
    ownerId: 'u1',
    deletedAt: null,
    slug: 'house-london',
    cardData: {
      v: 1,
      outline: { title: 'House London', titleId: 't0', items },
      blocks: []
    }
  }
  let calls = 0
  // The read answers only for this pad and this heading id; any other key is a miss.
  const resolve = (chat: Awaited<ReturnType<CardReads['chat']>>, id = 'h1') =>
    resolveCard({
      row,
      query: { id },
      kinds: new Set(['heading', 'document']),
      reads: {
        chat: async (documentId, linkId) => {
          calls += 1
          return documentId === 'doc1' && linkId === 'h1' ? chat : null
        },
        version: async () => null,
        members: async () => null
      },
      isDrawable: drawable
    })

  it('spends no chat read on a heading id the outline does not hold', async () => {
    calls = 0
    const card = await resolve(room(3), 'junk')
    expect(calls).toBe(0)
    expect(card.status === 'ok' && card.card.kind).toBe('document')
  })

  it('reads the heading room by the heading id', async () => {
    const card = await resolve(room(3))
    expect(card.status === 'ok' && card.card.values[3]).toBe('💬 3 messages')
  })

  it('still draws the Heading card, with no count, when the read is shed', async () => {
    for (const failed of ['shed', 'unavailable'] as const) {
      const card = await resolve(failed)
      expect(card.status).toBe('ok')
      expect(card.status === 'ok' && card.card.kind).toBe('heading')
      expect(card.status === 'ok' && card.card.values[3]).toBe('')
    }
  })
})
