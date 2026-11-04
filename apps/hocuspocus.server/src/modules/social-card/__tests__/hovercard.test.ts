// The access branches and the link kinds of `GET /api/documents/:docName/hovercard`, driven
// through the social-card `init`. Prisma, auth and the chat read all arrive as deps.
import { describe, expect, test } from 'bun:test'
import { Hono, type MiddlewareHandler } from 'hono'
import type { Logger } from 'pino'

import { createMockPrisma, TestServer } from '../../../../tests/helpers/test-server'
import { pmJsonToYdocBytes } from '../../../lib/nested-flat-migration'
import type { ChatRoom } from '../infra/chatRoom'
import type { HovercardChatRead } from '../infra/hovercardReads'
import { init } from '../module'

const OWNER = 'owner-1'
const STRANGER = 'stranger-2'
const DOCUMENT_ID = 'hovercardDoc0000001'
const MESSAGE_ID = '0b8f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4'

type Reader = { userId?: string; authUnavailable?: boolean }

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const auth =
  (reader: Reader): MiddlewareHandler =>
  async (c, next) => {
    if (reader.userId) {
      c.set('user', { sub: reader.userId, is_anonymous: false })
      c.set('userId', reader.userId)
    }
    if (reader.authUnavailable) c.set('authUnavailable', true)
    await next()
  }

const CARD_DATA = {
  v: 1,
  blocks: [],
  outline: {
    title: 'Launch plan',
    titleId: 't0',
    items: [
      {
        id: 'h1',
        level: 1,
        text: 'Goals',
        parent: -1,
        blocks: [
          { kind: 'paragraph', text: 'Ship it.' },
          { kind: 'list', list: 'bullet', items: [{ text: 'Fast' }, { text: 'Calm' }] }
        ]
      },
      { id: 'h2', level: 2, text: 'Scope', parent: 0, blocks: [] },
      { id: 'h3', level: 1, text: 'Risks', parent: -1, blocks: [] }
    ]
  }
}

const heading = (id: string, level: number, text: string) => ({
  type: 'heading',
  attrs: { level, 'toc-id': id },
  content: [{ type: 'text', text }]
})
const paragraph = (text: string, bold?: string) => ({
  type: 'paragraph',
  content: [
    { type: 'text', text },
    ...(bold ? [{ type: 'text', text: bold, marks: [{ type: 'bold' }] }] : [])
  ]
})

// Goals > Scope, then Risks. "apple" sits in two bodies; "apple pie" spans a bold boundary.
const HEAD = pmJsonToYdocBytes({
  type: 'doc',
  content: [
    heading('t0', 1, 'Launch plan'),
    heading('h1', 1, 'Goals'),
    paragraph('Ship the apple app'),
    heading('h2', 2, 'Scope'),
    paragraph('nothing else'),
    heading('h3', 1, 'Risks'),
    paragraph('apple ', 'pie')
  ]
})

const ROOM: ChatRoom = {
  headingId: 'h2',
  messages: 4,
  lastMessageAt: new Date('2026-11-01T10:00:00+00:00'),
  message: null
}
const MESSAGE = {
  sentAt: new Date('2026-11-01T09:00:00+00:00'),
  type: 'text',
  reactions: { '👍': 2, '🎉': 1 },
  replies: 2
}

interface Row {
  title: string
  isPrivate: boolean
  deletedAt?: Date | null
}

interface Options {
  query?: string
  chat?: HovercardChatRead
  head?: Uint8Array | null
}

const harness = (reader: Reader, row: Row | null | 'throws', options: Options = {}) => {
  const prisma = createMockPrisma() as any
  const reads: Record<string, unknown>[] = []
  const chatCalls: unknown[] = []
  prisma.documentMetadata.findUnique = async (args: { where: Record<string, unknown> }) => {
    reads.push(args.where)
    if (row === 'throws') throw new Error('database down')
    if (!row) return null
    if ('documentId' in args.where) {
      return args.where.documentId === DOCUMENT_ID ? { cardData: CARD_DATA } : null
    }
    return {
      documentId: DOCUMENT_ID,
      slug: 'launch-plan',
      title: row.title,
      isPrivate: row.isPrivate,
      ownerId: OWNER,
      deletedAt: row.deletedAt ?? null
    }
  }
  prisma.documents.findUnique = async (args: { where: any }) => {
    reads.push({ version: args.where.Documents_documentId_version_unique })
    const { documentId, version } = args.where.Documents_documentId_version_unique
    if (documentId !== DOCUMENT_ID || version !== 7) return null
    return {
      createdAt: new Date('2026-10-30T12:00:00Z'),
      commitMessage: 'Before launch',
      changeSummary: {
        v: 1,
        title: 'Launch plan',
        wordsAdded: 12,
        wordsRemoved: 3,
        sectionsAdded: 1,
        sectionsRemoved: 0,
        sectionsModified: 2,
        sectionsMoved: 1
      }
    }
  }
  prisma.documents.count = async (args: { where: Record<string, unknown> }) => {
    reads.push({ count: args.where })
    return 9
  }
  prisma.documents.findFirst = async (args: { where: Record<string, unknown> }) => {
    reads.push({ head: args.where })
    return { createdAt: new Date('2026-11-02T08:00:00Z') }
  }
  prisma.$queryRaw = async (_sql: TemplateStringsArray, ...values: unknown[]) => {
    reads.push({ snapshot: values })
    return [{ version: 9, data: options.head === undefined ? HEAD : options.head }]
  }

  const chat: HovercardChatRead = async (query) => {
    chatCalls.push(query)
    if (options.chat) return options.chat(query)
    return query.messageId ? { ...ROOM, message: MESSAGE } : ROOM
  }

  const app = new Hono()
  app.route(
    '/api/documents',
    init({
      prisma,
      logger: silentLogger,
      kinds: new Set(),
      fallbackImageUrl: 'https://example.test/card.png',
      publicUrl: null,
      optionalPadReader: auth(reader),
      hovercardChat: chat
    }).router
  )
  const path = `/api/documents/launch-plan/hovercard${options.query ? `?${options.query}` : ''}`
  const get = () => new TestServer(app).get(path)
  const data = async () => (await (await get()).json()).data
  // The outline read is the one keyed on documentId.
  const outlineRead = () => reads.some((where) => 'documentId' in where)
  return { get, data, reads, chatCalls, outlineRead }
}

const PAD = { kind: 'pad', title: 'Launch plan', sections: ['Goals', 'Scope'], total: 3 }
const PUBLIC: Row = { title: 'Launch plan', isPrivate: false }
// Every key at once, so each read the access check must stop is in reach.
const EVERY_KEY = `chatroom=h2&msg_id=${MESSAGE_ID}&version=7&history=1&terms=apple&id=h2`

describe('GET /api/documents/:docName/hovercard — access', () => {
  test.each([
    ['a reader who is not the owner', { userId: STRANGER }],
    ['a signed-out reader', {}],
    ['a reader whose access check cannot run', { authUnavailable: true }]
  ] as [string, Reader][])('a private pad is locked for %s', async (_name, reader) => {
    const { get, outlineRead } = harness(reader, { title: 'Launch plan', isPrivate: true })
    const response = await get()

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({ locked: true })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(outlineRead()).toBe(false)
  })

  test('a locked pad reads nothing past the slug row, whatever the link asks for', async () => {
    const { data, reads, chatCalls } = harness(
      { userId: STRANGER },
      { title: 'x', isPrivate: true },
      { query: EVERY_KEY }
    )

    expect(await data()).toEqual({ locked: true })
    expect(reads).toEqual([{ slug: 'launch-plan' }])
    expect(chatCalls).toEqual([])
  })

  test('the owner of a private pad gets its outline, read by documentId', async () => {
    const { get, reads } = harness({ userId: OWNER }, { title: 'Launch plan', isPrivate: true })
    const response = await get()

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual(PAD)
    expect(reads).toEqual([{ slug: 'launch-plan' }, { documentId: DOCUMENT_ID }])
  })

  test('the owner of a private pad gets its heading chat', async () => {
    const { data, chatCalls } = harness(
      { userId: OWNER },
      { title: 'Launch plan', isPrivate: true },
      { query: 'chatroom=h2' }
    )

    expect((await data()).kind).toBe('chat')
    expect(chatCalls).toEqual([{ documentId: DOCUMENT_ID, linkId: 'h2', match: 'link' }])
  })

  test('any reader of a public pad gets its outline', async () => {
    const { get } = harness({}, PUBLIC)
    const response = await get()

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual(PAD)
  })

  test('a Pad title still equal to the slug gives way to the Title', async () => {
    const { get } = harness({}, { title: 'launch-plan', isPrivate: false })
    const response = await get()

    expect((await response.json()).data.title).toBe('Launch plan')
  })

  test('an unknown pad is a 404 and drafts nothing', async () => {
    const { get, reads } = harness({ userId: OWNER }, null)
    const response = await get()

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(reads).toEqual([{ slug: 'launch-plan' }])
  })

  // Not `locked`: that would call a public pad private during a database blip.
  test('a failed read is a 500 that names no title and no section', async () => {
    const { get } = harness({ userId: OWNER }, 'throws')
    const response = await get()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.data).toBeUndefined()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  test('a soft-deleted pad is a 404, even for its owner', async () => {
    const { get, outlineRead } = harness(
      { userId: OWNER },
      { title: 'Launch plan', isPrivate: false, deletedAt: new Date('2026-01-01T00:00:00Z') }
    )
    const response = await get()

    expect(response.status).toBe(404)
    expect(outlineRead()).toBe(false)
  })
})

describe('GET /api/documents/:docName/hovercard — link kinds', () => {
  test.each([
    [EVERY_KEY, 'version'],
    [`chatroom=h2&msg_id=${MESSAGE_ID}&history=1&terms=apple&id=h2`, 'history'],
    [`chatroom=h2&msg_id=${MESSAGE_ID}&terms=apple&id=h2`, 'filter'],
    [`chatroom=h2&msg_id=${MESSAGE_ID}&id=h2`, 'message'],
    ['chatroom=h2&id=h2', 'chat'],
    ['id=h2', 'heading'],
    ['', 'pad'],
    // A bad shape is dropped, and the next kind in line answers.
    ['chatroom=bad%20id&msg_id=not-a-uuid&id=h2', 'heading'],
    ['chatroom=h2&msg_id=not-a-uuid', 'chat'],
    ['version=0&history=yes&id=h2', 'heading']
  ])('?%s answers the %s kind', async (query, kind) => {
    const { data } = harness({}, PUBLIC, { query })

    expect((await data()).kind).toBe(kind)
  })

  test('a heading carries its trail, lines, subsections and chat count', async () => {
    const { data, chatCalls } = harness({}, PUBLIC, { query: 'id=h1' })

    expect(await data()).toEqual({
      kind: 'heading',
      padTitle: 'Launch plan',
      title: 'Goals',
      trail: [],
      subsections: 1,
      lines: ['Ship it.', 'Fast'],
      messages: 4
    })
    // By heading_id only: `channels.id` is global (#402).
    expect(chatCalls).toEqual([{ documentId: DOCUMENT_ID, linkId: 'h1', match: 'heading' }])
  })

  test('a heading whose chat read fails still answers, and leaves the count out', async () => {
    const { data } = harness({}, PUBLIC, {
      query: 'id=h2',
      chat: async () => {
        throw new Error('timeout')
      }
    })

    expect(await data()).toEqual({
      kind: 'heading',
      padTitle: 'Launch plan',
      title: 'Scope',
      trail: ['Goals'],
      subsections: 0,
      lines: []
    })
  })

  test('a chat reply holds counts and dates, and nothing a person wrote', async () => {
    const { data } = harness({}, PUBLIC, { query: 'chatroom=channel-1' })

    expect(await data()).toEqual({
      kind: 'chat',
      padTitle: 'Launch plan',
      heading: 'Scope',
      trail: ['Goals'],
      messages: 4,
      lastMessageAt: '2026-11-01T10:00:00.000Z'
    })
  })

  test('the pad room names the pad as its heading', async () => {
    const { data } = harness({}, PUBLIC, {
      query: `chatroom=${DOCUMENT_ID}`,
      chat: async () => ({ ...ROOM, headingId: DOCUMENT_ID, lastMessageAt: null })
    })

    expect(await data()).toEqual({
      kind: 'chat',
      padTitle: 'Launch plan',
      heading: 'Launch plan',
      trail: [],
      messages: 4
    })
  })

  test('a message reply holds its time and counts only', async () => {
    const { data, chatCalls } = harness({}, PUBLIC, { query: `chatroom=h2&msg_id=${MESSAGE_ID}` })

    expect(await data()).toEqual({
      kind: 'message',
      padTitle: 'Launch plan',
      heading: 'Scope',
      trail: ['Goals'],
      sentAt: '2026-11-01T09:00:00.000Z',
      replies: 2,
      reactions: 3
    })
    // One read: the message rides the room query.
    expect(chatCalls).toEqual([
      { documentId: DOCUMENT_ID, linkId: 'h2', match: 'link', messageId: MESSAGE_ID }
    ])
  })

  test('a version carries its name, save time and change summary', async () => {
    const { data } = harness({}, PUBLIC, { query: 'version=7' })

    expect(await data()).toEqual({
      kind: 'version',
      padTitle: 'Launch plan',
      version: 7,
      name: 'Before launch',
      savedAt: '2026-10-30T12:00:00.000Z',
      sectionsChanged: 4,
      wordsAdded: 12,
      wordsRemoved: 3
    })
  })

  test('history carries the version count and the last save', async () => {
    const { data } = harness({}, PUBLIC, { query: 'history=1' })

    expect(await data()).toEqual({
      kind: 'history',
      padTitle: 'Launch plan',
      versions: 9,
      lastSavedAt: '2026-11-02T08:00:00.000Z'
    })
  })

  test('a filter matches heading and body text, and shows ancestors and descendants', async () => {
    const { data } = harness({}, PUBLIC, { query: 'terms=apple' })

    // Goals and Risks match in their bodies; Scope shows as a descendant of Goals.
    expect(await data()).toEqual({
      kind: 'filter',
      padTitle: 'Launch plan',
      terms: ['apple'],
      mode: 'or',
      shown: ['Goals', 'Scope'],
      shownCount: 3,
      total: 3
    })
  })

  test('a filter keeps the ancestors of a match', async () => {
    const { data } = harness({}, PUBLIC, { query: 'terms=nothing' })

    expect(await data()).toMatchObject({ shown: ['Goals', 'Scope'], shownCount: 2, total: 3 })
  })

  test('`and` needs every term in one section, and a term never spans two text nodes', async () => {
    const both = harness({}, PUBLIC, { query: 'terms=apple&terms=ship&mode=and' })
    const split = harness({}, PUBLIC, { query: 'terms=apple-pie' })

    expect(await both.data()).toMatchObject({
      mode: 'and',
      shownCount: 2,
      shown: ['Goals', 'Scope']
    })
    expect(await split.data()).toMatchObject({ shownCount: 0, shown: [] })
  })

  test.each([
    ['an unknown heading', 'id=nope', {}],
    ['an unknown chat', 'chatroom=nope', async () => null],
    [
      'an unknown message',
      `chatroom=h2&msg_id=${MESSAGE_ID}`,
      async () => ({ ...ROOM, message: null })
    ],
    [
      'a failed chat read',
      'chatroom=h2',
      async () => {
        throw new Error('timeout')
      }
    ],
    ['a chat whose heading is gone', 'chatroom=h2', async () => ({ ...ROOM, headingId: 'gone' })],
    ['an unknown version', 'version=8', {}]
  ] as [string, string, HovercardChatRead | undefined][])(
    '%s falls back to the pad card',
    async (_name, query, chat) => {
      const { get } = harness({}, PUBLIC, { query, chat })
      const response = await get()

      expect(response.status).toBe(200)
      expect((await response.json()).data).toEqual(PAD)
    }
  )

  test('a head over the size cap is never decoded, and the pad card answers', async () => {
    const { data } = harness({}, PUBLIC, { query: 'terms=apple', head: null })

    expect(await data()).toEqual(PAD)
  })
})
