import { beforeEach, describe, expect, test } from 'bun:test'
import { createMcpHandler } from '@modelcontextprotocol/server'
import type { Logger } from 'pino'

import { createMockPrisma } from '../../../../../tests/helpers/test-server'
import { createServerFactory } from '../../http/serverFactory'
import type { ChatStore, DocumentRecord } from '../../types'

const OWNER = 'owner-1'
const CALLER = 'caller-2'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const sectionArgs = { section_id: 'h1', rev: '0123456789ab' }

// Every tool that opens a document, with arguments its input schema accepts.
const READ_TOOLS: Record<string, Record<string, unknown>> = {
  get_outline: {},
  read_document: {},
  list_chat_rooms: {},
  read_chat_thread: { section_id: 'h1' }
}
const OWN_TOOLS: Record<string, Record<string, unknown>> = {
  append_to_document: { markdown: 'More text' },
  edit_blocks: { ...sectionArgs, after_block: 0, markdown: 'More text' },
  replace_text: { ...sectionArgs, old_text: 'old', new_text: 'new' },
  post_chat_message: { section_id: 'h1', text: 'Hello' }
}

const row = (overrides: Partial<DocumentRecord>): DocumentRecord => ({
  documentId: 'doc-1',
  slug: 'garden',
  isPrivate: false,
  readOnly: false,
  ownerId: OWNER,
  deletedAt: null,
  ...overrides
})

interface Harness {
  call: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ isError?: boolean; text: string }>
  reads: string[]
  writes: number
}

const harness = (doc: DocumentRecord): Harness => {
  const prisma = createMockPrisma() as any
  prisma.documentMetadata.findUnique = async () => doc
  const state = { reads: [] as string[], writes: 0 }
  const chat: ChatStore = {
    listRooms: async () => [],
    findRoom: async () => 'channel-1',
    readThread: async () => ({ messages: [], hasMore: false }),
    postMessage: async () => {
      state.writes++
      return { seq: 1 }
    }
  }
  const handler = createMcpHandler(
    createServerFactory({
      prisma,
      logger: silentLogger,
      content: {
        read: async (documentId) => {
          state.reads.push(documentId)
          return { status: 'ok', content: { type: 'doc', content: [] } }
        },
        apply: async () => {
          state.writes++
          return { status: 'applied' }
        }
      },
      budget: async () => ({ ok: true }),
      usage: () => {},
      chat,
      appUrl: 'https://docs.example',
      version: 'test'
    })
  )

  let id = 0
  const call: Harness['call'] = async (name, args) => {
    const response = await handler.fetch(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++id,
          method: 'tools/call',
          params: { name, arguments: { slug: doc.slug, ...args } }
        })
      }),
      {
        authInfo: {
          token: 'unused',
          clientId: 'app',
          scopes: [],
          extra: { sub: CALLER, isAnonymous: false }
        }
      }
    )
    const raw = await response.text()
    // The transport may answer as SSE; the JSON-RPC message is the data line.
    const json = raw.trimStart().startsWith('{')
      ? raw
      : (raw.split('\n').find((line) => line.startsWith('data:')) ?? '').slice(5)
    const message = JSON.parse(json)
    if (!message.result) throw new Error(`tools/call ${name} failed: ${json}`)
    return { isError: message.result.isError, text: message.result.content[0].text }
  }
  return Object.assign(state, { call })
}

// A wrong `read`/`own` choice or a broken owner check lets an agent read or write
// another person's document. wsAccess.test.ts covers the Private rule itself.
describe('MCP tool access', () => {
  describe('a Private document someone else owns', () => {
    let h: Harness
    beforeEach(() => {
      h = harness(row({ isPrivate: true }))
    })

    for (const [name, args] of Object.entries({ ...READ_TOOLS, ...OWN_TOOLS })) {
      test(`${name} refuses it`, async () => {
        const result = await h.call(name, args)
        expect(result.isError).toBe(true)
        expect(result.text).toBe('slug: "garden" is private. Only its owner can open it.')
        expect(h.reads).toHaveLength(0)
        expect(h.writes).toBe(0)
      })
    }
  })

  describe('a public document someone else owns', () => {
    let h: Harness
    beforeEach(() => {
      h = harness(row({}))
    })

    for (const [name, args] of Object.entries(OWN_TOOLS)) {
      test(`${name} refuses to write in it`, async () => {
        const result = await h.call(name, args)
        expect(result.isError).toBe(true)
        expect(result.text).toContain('slug: "garden" belongs to another person.')
        expect(h.reads).toHaveLength(0)
        expect(h.writes).toBe(0)
      })
    }

    // Control: the same caller and document pass the read tools, so the refusals
    // above come from the owner check and not from the harness.
    test('get_outline still reads it', async () => {
      const result = await h.call('get_outline', READ_TOOLS.get_outline)
      expect(result.isError).toBeUndefined()
      expect(h.reads).toEqual(['doc-1'])
    })
  })
})
