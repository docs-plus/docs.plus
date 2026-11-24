import { describe, expect, test } from 'bun:test'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { Logger } from 'pino'

import { createMockPrisma } from '../../../../../tests/helpers/test-server'
import { AppError } from '../../../../lib/errors'
import { acquireLargeDecode, LARGE_DECODE_BYTES } from '../../../../lib/largeDecodeGate'
import type { WriteAccessMirror } from '../../../document-content/infra/contentStore'
import type { ApplyRequest, TiptapDocJson } from '../../../document-content/types'
import { callerFrom } from '../../http/controller'
import { registerChatTools } from '../../tools/chatTools'
import { registerDocumentTools } from '../../tools/documentTools'
import { createToolContext } from '../../tools/toolContext'
import type { ChatStore, DocumentRecord, ServerFactoryDeps } from '../../types'

const OWNER = 'owner-1'

const makeLogger = () => {
  const errors: unknown[] = []
  const logger = {
    info: () => {},
    warn: () => {},
    error: (...args: unknown[]) => {
      errors.push(args)
    },
    debug: () => {},
    child: () => logger
  } as unknown as Logger
  return { logger, errors }
}

const makeDoc = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => ({
  documentId: 'doc-1',
  slug: 'garden',
  isPrivate: false,
  readOnly: false,
  ownerId: OWNER,
  deletedAt: null,
  ...overrides
})

const createToolHarness = (
  initialContent: TiptapDocJson,
  docOverrides: Partial<DocumentRecord> = {},
  options: { writeAccessMirror?: WriteAccessMirror } = {}
) => {
  const doc = makeDoc(docOverrides)
  const prisma = createMockPrisma() as any
  const createdMetadata: Array<
    { documentId: string; isPrivate?: boolean } & Record<string, unknown>
  > = []
  prisma.documentMetadata.findUnique = async () => doc
  prisma.documentMetadata.findMany = async () => [
    {
      slug: doc.slug,
      title: 'Title',
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
      isPrivate: doc.isPrivate,
      readOnly: doc.readOnly,
      ownerId: doc.ownerId
    }
  ]
  prisma.documentMetadata.create = async (arg: {
    data: { documentId: string; isPrivate?: boolean } & Record<string, unknown>
  }) => {
    createdMetadata.push(arg.data)
    return {
      documentId: arg.data.documentId ?? 'created-1',
      slug: arg.data.slug,
      title: arg.data.title,
      ownerId: OWNER,
      isPrivate: arg.data.isPrivate ?? false,
      createdAt: new Date()
    }
  }
  const applied: ApplyRequest[] = []
  const { logger, errors } = makeLogger()
  const chat: ChatStore = {
    listRooms: async () => [],
    findRoom: async () => 'channel-1',
    readThread: async () => ({ messages: [], hasMore: false }),
    postMessage: async () => ({ seq: 1 })
  }

  const deps: ServerFactoryDeps = {
    prisma,
    logger,
    content: {
      read: async () => ({ status: 'ok', content: initialContent }),
      apply: async (request) => {
        applied.push(request)
        return {
          status: 'applied',
          version: 2,
          ...(request.mode === 'text' ? { rev: '111111111111' } : {})
        }
      }
    },
    budget: async () => ({ ok: true }),
    usage: () => {},
    chat,
    appUrl: 'https://docs.example',
    version: 'test'
  }

  const handler = createMcpHandler(({ authInfo }) => {
    const context = createToolContext(deps, callerFrom(authInfo))
    const server = new McpServer({ name: 'docs.plus', version: deps.version })
    registerDocumentTools(server, deps, context, options)
    registerChatTools(server, deps, context)
    return server
  })

  let id = 0
  const rpc = async (method: string, params?: Record<string, unknown>) => {
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
          method,
          ...(params ? { params } : {})
        })
      }),
      {
        authInfo: {
          token: 'unused',
          clientId: 'app',
          scopes: [],
          extra: { sub: OWNER, isAnonymous: false }
        }
      }
    )
    const raw = await response.text()
    const json = raw.trimStart().startsWith('{')
      ? raw
      : (raw.split('\n').find((line) => line.startsWith('data:')) ?? '').slice(5)
    const message = JSON.parse(json)
    if (!message.result) throw new Error(`${method} failed: ${json}`)
    return message.result
  }

  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await rpc('tools/call', { name, arguments: args })
    return {
      isError: result.isError as boolean | undefined,
      text: result.content[0].text as string,
      structuredContent: result.structuredContent as Record<string, unknown> | undefined
    }
  }

  const listTools = async () => {
    const result = await rpc('tools/list')
    return result.tools as Array<{
      name: string
      outputSchema?: Record<string, unknown>
      annotations?: Record<string, unknown>
    }>
  }

  return { call, listTools, applied, errors, createdMetadata }
}

const sectionRev = async (
  call: (name: string, args: Record<string, unknown>) => Promise<{ text: string }>,
  sectionId: string
) => {
  const res = await call('read_document', { slug: 'garden', section_id: sectionId })
  const match = res.text.match(/^rev: ([0-9a-f]{12})/m)
  if (!match) throw new Error(`No rev in read_document response:\n${res.text}`)
  return match[1]
}

const baseDoc: TiptapDocJson = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, 'toc-id': 'title' },
      content: [{ type: 'text', text: 'Title' }]
    },
    {
      type: 'heading',
      attrs: { level: 2, 'toc-id': 'sec2' },
      content: [{ type: 'text', text: 'Sec' }]
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'foo_bar' }] },
    {
      type: 'heading',
      attrs: { level: 6, 'toc-id': 'sec6' },
      content: [{ type: 'text', text: 'Deep' }]
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'deep body' }] }
  ]
}

describe('MCP documentTools', () => {
  test('parseFragment refuses deep Markdown and > MAX_CONTENT_NODES tables cleanly without calling apply or largeDecodeGate', async () => {
    const { call, applied, errors } = createToolHarness(baseDoc)
    const rev = await sectionRev(call, 'sec2')

    const deep = `${'> '.repeat(5000)}hi`
    const deepCalls = [
      call('create_document', { title: 'Deep', markdown: deep }),
      call('append_to_document', { slug: 'garden', markdown: deep }),
      call('edit_blocks', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        after_block: 0,
        markdown: deep
      }),
      call('rewrite_section', { slug: 'garden', section_id: 'sec2', rev, markdown: deep }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `- a\nlazy\n  \`\`\`\n    \`\`\`\n  ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `-\n  \`\`\`\n    \`\`\`\n  ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `1. a\n   \`\`\`\n   2. b\n   ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `- <div>\n  \`\`\`\n\n  ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `- [ ] a\n\n  \`\`\`\n    \`\`\`\n  ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `1. a\n\n\tx\n  \`\`\`\n    \`\`\`\n  ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `1000. a\n\n     <pre>\n  \`\`\`\n     </pre>\n  ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `para\n<custom-widget>\n\`\`\`\n\n\`\`\`\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `[a]: https://example.test "foo\n\`\`\`\n" extra\n\`\`\`\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `\`\`\`\n\`\`\`\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `- a\n---\t\n   \`\`\`\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `>     code\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `| a | b |\n| --- | --- |\n    code\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `<!DOCTYPE\n> \`\`\`\n   \`\`\`\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `<precustom>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `</foo\n\n>\n\`\`\`\n\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `| a | b |\n| --- | --- |\n\t \n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('edit_blocks', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        after_block: 0,
        markdown: `2. a\n\t\n[a]:\n~~~\n${deep}`
      }),
      call('edit_blocks', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        after_block: 0,
        markdown: `- [ ] a\n x\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('rewrite_section', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        markdown: `> - a\n>\t\tcode\n[a]:\n\`\`\`\`\n\`\`\`\`\n${deep}`
      }),
      call('create_document', {
        title: 'DeepBQList',
        markdown: `> 1. a\n> > - a\n[a]:\n\`\`\`ts\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `  x\n2. a\n--- | ---\n   \`\`\`\n-\t\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `  - [ ] a\n   \`\`\`\n\tx\n   ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `| \` \`\` \`\`\` \`\`\`\` \`\`\`\`\` \`\`\`\`\`\` \`a|b\` \`c|d\` \`e|f\` | x |\n| --- | --- |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `x | a | b |\n| --- | --- |\n    \u00A0\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('edit_blocks', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        after_block: 0,
        markdown: `x- [ ] a\n x\n<custom>\n\`\`\`\n\n${deep}`
      }),
      call('rewrite_section', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        markdown: `1.\n| \`a|b\` | c |\n| --- | --- |\n~~~~~\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `para\n> a\n<!DOCTYPE > ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `    - a\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`ts\n${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `- a\n</foo\n</foo\t\n>\n<!DOCTYPE ${deep}`
      }),
      call('append_to_document', {
        slug: 'garden',
        markdown: `- a\n<precustom>\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`\n${deep}`
      }),
      call('create_document', {
        title: 'DeepContainerPre',
        markdown: `1000. a\n\n     <pre>\n[a]:\n\`\`\`\n${deep}`
      })
    ]
    for (const res of await Promise.all(deepCalls)) {
      expect(res.isError).toBe(true)
      expect(res.text).toContain('32 levels')
    }

    // < 64 KiB wide table exceeding MAX_CONTENT_NODES (50,000)
    const row = `${'|a'.repeat(100)}|\n`
    const wideTable = `${row}${'|-'.repeat(100)}|\n${row.repeat(260)}`
    expect(wideTable.length).toBeLessThan(64 * 1024)
    const wideRes = await call('append_to_document', { slug: 'garden', markdown: wideTable })
    expect(wideRes.isError).toBe(true)
    expect(wideRes.text).toContain('50000 nodes')

    expect(applied).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  test('allows fenced deep quotes and normal MCP writes while largeDecodeGate is held', async () => {
    const { call, applied } = createToolHarness(baseDoc)
    const release = await acquireLargeDecode(LARGE_DECODE_BYTES, 0)
    expect(release).not.toBeNull()

    try {
      const res = await call('append_to_document', {
        slug: 'garden',
        markdown: `\`\`\`\n${'> '.repeat(200)}hi\n\`\`\``
      })
      expect(res.isError).toBeUndefined()
      expect(applied).toHaveLength(1)
    } finally {
      release?.()
    }
  })

  test('replace_text keeps literal backslashes in new_text when old_text triggers unescape fallback', async () => {
    const { call, applied } = createToolHarness(baseDoc)
    const rev = await sectionRev(call, 'sec2')

    const pathRes = await call('replace_text', {
      slug: 'garden',
      section_id: 'sec2',
      rev,
      old_text: 'foo\\_bar',
      new_text: 'C:\\Users\\docs\\d+\\.txt'
    })
    expect(pathRes.isError).toBeUndefined()
    expect(applied[0]).toMatchObject({
      mode: 'text',
      oldText: 'foo_bar',
      newText: 'C:\\Users\\docs\\d+\\.txt'
    })

    const slashRes = await call('replace_text', {
      slug: 'garden',
      section_id: 'sec2',
      rev,
      old_text: 'foo\\_bar',
      new_text: 'foo\\_bar'
    })
    expect(slashRes.isError).toBeUndefined()
    expect(applied[1]).toMatchObject({
      mode: 'text',
      oldText: 'foo_bar',
      newText: 'foo\\_bar'
    })
  })

  test('refuses nested H1 headings across all 4 Markdown write tools', async () => {
    const { call, applied } = createToolHarness(baseDoc)
    const rev = await sectionRev(call, 'sec2')

    for (const bad of ['> # Secret H1', '- item\n\n  # Secret H1']) {
      for (const res of await Promise.all([
        call('create_document', { title: 'Test', markdown: bad }),
        call('append_to_document', { slug: 'garden', markdown: bad }),
        call('edit_blocks', {
          slug: 'garden',
          section_id: 'sec2',
          rev,
          after_block: 0,
          markdown: bad
        }),
        call('rewrite_section', { slug: 'garden', section_id: 'sec2', rev, markdown: bad })
      ])) {
        expect(res.isError).toBe(true)
      }
    }

    const emptyDocHarness = createToolHarness({ type: 'doc', content: [] })
    const emptyRes = await emptyDocHarness.call('append_to_document', {
      slug: 'garden',
      markdown: '> # Secret H1'
    })
    expect(emptyRes.isError).toBe(true)
    expect(emptyDocHarness.applied).toHaveLength(0)
    expect(applied).toHaveLength(0)
  })

  test('rewrite_section allows standalone [1] in a media-free section', async () => {
    const { call, applied } = createToolHarness(baseDoc)
    const rev = await sectionRev(call, 'sec2')

    for (const markdown of ['\\[1\\]', '[1]']) {
      const res = await call('rewrite_section', {
        slug: 'garden',
        section_id: 'sec2',
        rev,
        markdown
      })
      expect(res.isError).toBeUndefined()
    }
    expect(applied).toHaveLength(2)
    expect(applied[0]).toMatchObject({
      mode: 'rewrite',
      keep: [],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '[1]' }] }]
      }
    })
  })

  test('refuses new headings in an H6 section without saying level 7 or deeper', async () => {
    const { call, applied } = createToolHarness(baseDoc)
    const rev = await sectionRev(call, 'sec6')

    for (const res of await Promise.all([
      call('edit_blocks', {
        slug: 'garden',
        section_id: 'sec6',
        rev,
        after_block: 1,
        markdown: '###### Too deep'
      }),
      call('rewrite_section', {
        slug: 'garden',
        section_id: 'sec6',
        rev,
        markdown: '## Sub'
      })
    ])) {
      expect(res.isError).toBe(true)
      expect(res.text).toContain('level 6 is the deepest heading level')
      expect(res.text).not.toContain('level 7')
    }
    expect(applied).toHaveLength(0)
  })

  test('registers outputSchema on all 7 write tools, omits it on all 5 read tools, and marks move_block non-destructive', async () => {
    const mirrorCalls: unknown[] = []
    const multiBlockDoc: TiptapDocJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, 'toc-id': 'title' },
          content: [{ type: 'text', text: 'Title' }]
        },
        {
          type: 'heading',
          attrs: { level: 2, 'toc-id': 'sec2' },
          content: [{ type: 'text', text: 'Sec' }]
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo_bar' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second block' }] }
      ]
    }
    const { call, listTools } = createToolHarness(
      multiBlockDoc,
      {},
      {
        writeAccessMirror: async (params) => {
          mirrorCalls.push(params)
        }
      }
    )

    const tools = await listTools()
    const byName = new Map(tools.map((tool) => [tool.name, tool]))

    const writeTools = [
      'create_document',
      'append_to_document',
      'edit_blocks',
      'replace_text',
      'move_block',
      'rewrite_section',
      'post_chat_message'
    ]
    const readTools = [
      'find_documents',
      'get_outline',
      'read_document',
      'list_chat_rooms',
      'read_chat_thread'
    ]

    for (const name of writeTools) {
      expect(byName.get(name)?.outputSchema).toBeDefined()
    }
    for (const name of readTools) {
      expect(byName.get(name)?.outputSchema).toBeUndefined()
    }
    expect(byName.get('move_block')?.annotations?.destructiveHint).toBe(false)

    // Verify all 5 read tools omit structuredContent and all 7 write tools pass outputSchema validation.
    for (const [name, args] of [
      ['find_documents', {}],
      ['get_outline', { slug: 'garden' }],
      ['read_document', { slug: 'garden' }],
      ['list_chat_rooms', { slug: 'garden' }],
      ['read_chat_thread', { slug: 'garden', section_id: 'sec2' }]
    ] as const) {
      const res = await call(name, args)
      expect(res.isError).toBeUndefined()
      expect(res.structuredContent).toBeUndefined()
    }

    const rev = await sectionRev(call, 'sec2')
    const writeCalls = [
      ['create_document', { title: 'Schema Check' }],
      ['append_to_document', { slug: 'garden', markdown: 'Added paragraph' }],
      ['edit_blocks', { slug: 'garden', section_id: 'sec2', rev, after_block: 0, markdown: 'New' }],
      [
        'replace_text',
        { slug: 'garden', section_id: 'sec2', rev, old_text: 'foo_bar', new_text: 'baz' }
      ],
      ['move_block', { slug: 'garden', section_id: 'sec2', rev, from: 2, after_block: 0 }],
      ['rewrite_section', { slug: 'garden', section_id: 'sec2', rev, markdown: 'Rewritten' }],
      ['post_chat_message', { slug: 'garden', section_id: 'sec2', text: 'Hello' }]
    ] as const

    for (const [name, args] of writeCalls) {
      const res = await call(name, args)
      expect(res.isError).toBeUndefined()
      expect(res.structuredContent).toBeDefined()
    }
    expect(mirrorCalls).toHaveLength(0)
  })

  test('read_document outputs image alt, upload-in-progress, and file link markers', async () => {
    const mediaDoc: TiptapDocJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, 'toc-id': 'title' },
          content: [{ type: 'text', text: 'Media Doc' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'image', attrs: { src: 'https://cdn.example/a.png', alt: 'Chart\nOne' } },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              text: 'deck.pdf',
              marks: [
                {
                  type: 'hyperlink',
                  attrs: { href: 'https://api.example/plugins/hypermultimedia/doc-1/deck.pdf' }
                }
              ]
            }
          ]
        },
        { type: 'mediaUploadPlaceholder' }
      ]
    }
    const { call } = createToolHarness(mediaDoc)
    const fullRes = await call('read_document', { slug: 'garden' })
    expect(fullRes.isError).toBeUndefined()
    expect(fullRes.text).toContain('\\[image: Chart One\\]')
    expect(fullRes.text).toContain('deck.pdf \\[file\\]')
    expect(fullRes.text).toContain('\\[upload in progress\\]')

    const sectionRes = await call('read_document', { slug: 'garden', section_id: 'title' })
    expect(sectionRes.isError).toBeUndefined()
    expect(sectionRes.text).toContain('[1] \\[image: Chart One\\] and deck.pdf \\[file\\]')
    expect(sectionRes.text).toContain('[2] \\[upload in progress\\]')
  })

  test('create_document defaults to public, supports private Invite only, and fails closed on 503 mirror error', async () => {
    const mirrorCalls: Array<{ documentId: string; isPrivate: boolean; ownerId: string | null }> =
      []
    const okHarness = createToolHarness(
      baseDoc,
      {},
      {
        writeAccessMirror: async (params) => {
          mirrorCalls.push(params)
        }
      }
    )

    const pubRes = await okHarness.call('create_document', { title: 'Public Note' })
    expect(pubRes.isError).toBeUndefined()
    expect(pubRes.text).toContain('(public)')
    expect(pubRes.structuredContent).toMatchObject({
      slug: 'public-note',
      title: 'Public Note',
      version: 1,
      private: false
    })
    expect(mirrorCalls).toHaveLength(0)
    expect(okHarness.createdMetadata[0]?.isPrivate).toBe(false)

    const privRes = await okHarness.call('create_document', {
      title: 'Secret Note',
      private: true
    })
    expect(privRes.isError).toBeUndefined()
    expect(privRes.text).toContain('(Invite only)')
    expect(privRes.structuredContent).toMatchObject({
      slug: 'secret-note',
      title: 'Secret Note',
      version: 1,
      private: true
    })
    expect(mirrorCalls).toEqual([
      {
        documentId: okHarness.createdMetadata[1].documentId,
        isPrivate: true,
        ownerId: OWNER
      }
    ])
    expect(okHarness.createdMetadata[1]?.isPrivate).toBe(true)

    const failHarness = createToolHarness(
      baseDoc,
      {},
      {
        writeAccessMirror: async () => {
          throw new AppError('Document access could not be saved', 503, 'SERVICE_UNAVAILABLE')
        }
      }
    )
    const failRes = await failHarness.call('create_document', {
      title: 'Blocked Note',
      private: true
    })
    expect(failRes.isError).toBe(true)
    expect(failRes.text).toContain('Invite only')
    expect(failRes.text).toContain('no document was created')
    expect(failHarness.createdMetadata).toHaveLength(0)
    expect(failHarness.errors).toHaveLength(0)
  })
})
