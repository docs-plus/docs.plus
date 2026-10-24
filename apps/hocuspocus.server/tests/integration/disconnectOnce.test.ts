/**
 * Pins #601: Hocuspocus 3.4.4 fires `onDisconnect` twice for one client close
 * (upstream ueberdosis/hocuspocus#1199). A real server and a real provider close
 * once, and each disconnect RPC and the Last left metric must still count once.
 */
import { afterAll, beforeAll, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { type Extension, Server } from '@hocuspocus/server'
import * as Y from 'yjs'

const USER = '83bac16e-8ba7-4c1c-88c0-6e0a024b52c7'
const DOC = 'disconnect-once'
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
const REPO_ROOT = new URL('../../../../', import.meta.url).pathname

const rpcCalls: string[] = []

// Sticky across files in one `bun test` run, so keep every export other suites read.
mock.module('../../src/lib/supabase', () => ({
  SUPABASE_FETCH_TIMEOUT_MS: 10_000,
  getAnonClient: () => null,
  getServiceRoleClient: () => ({
    rpc: async (name: string) => {
      rpcCalls.push(name)
      return { data: name === 'enqueue_document_view' ? { view_id: 'view-1' } : true, error: null }
    }
  })
}))

const { DocumentViewsExtension } = await import('../../src/extensions/document-views.extension')
const { DocumentOccupancyExtension, READ_DWELL_MS } =
  await import('../../src/extensions/document-occupancy.extension')
const { documentLastLeftStampsTotal } = await import('../../src/lib/metrics')

// The provider is a webapp dependency, so it is resolved there, as the e2e scripts do.
const { HocuspocusProvider } = (await import(
  Bun.resolveSync('@hocuspocus/provider', `${REPO_ROOT}apps/webapp`)
)) as { HocuspocusProvider: new (config: Record<string, unknown>) => any }

// Bun's WebSocket takes headers; the views hook skips a socket with no browser agent.
class BrowserSocket extends WebSocket {
  constructor(url: string) {
    super(url, { headers: { 'user-agent': BROWSER_UA } } as unknown as string[])
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const count = (name: string) => rpcCalls.filter((call) => call === name).length
const stamped = async () =>
  (await documentLastLeftStampsTotal.get()).values.find((v) => v.labels.outcome === 'stamped')
    ?.value ?? 0

let hookRuns = 0
const probe: Extension = {
  async onDisconnect() {
    hookRuns += 1
  }
}

const probePort = Bun.serve({ port: 0, fetch: () => new Response('') })
const port = probePort.port
probePort.stop(true)

const server = new Server({
  port,
  quiet: true,
  async onAuthenticate() {
    return { user: { sub: USER }, deviceType: 'desktop' }
  },
  extensions: [probe, new DocumentViewsExtension(), new DocumentOccupancyExtension()]
})

describe('one client close', () => {
  let stampedBefore = 0

  beforeAll(async () => {
    await server.listen()
    stampedBefore = await stamped()

    const provider = new HocuspocusProvider({
      url: `ws://127.0.0.1:${port}`,
      name: DOC,
      document: new Y.Doc(),
      token: 'test',
      WebSocketPolyfill: BrowserSocket
    })
    await new Promise((resolve) => provider.on('synced', resolve))
    await sleep(100)

    // Past the dwell, the next client message marks the visit as read, so the close stamps.
    setSystemTime(new Date(Date.now() + READ_DWELL_MS + 1000))
    provider.setAwarenessField('user', { name: 'reader' })
    await sleep(200)

    // Awareness is still set here, which is the state that makes the hook run twice.
    provider.disconnect()
    await sleep(500)
    provider.destroy()
  })

  afterAll(async () => {
    setSystemTime()
    await server.destroy()
  })

  test('CONTROL Hocuspocus still runs onDisconnect twice for this close', () => {
    // A 1 means a fix for hocuspocus#1199, or v4's default `flushDelay: 0` hiding it.
    // Either way, drop this control and the one-shot takes in both hooks.
    expect(hookRuns).toBe(2)
  })

  test('CONTROL the socket opened a view, so the duration write was reachable', () => {
    expect(count('enqueue_document_view')).toBe(1)
  })

  test('the view duration is written once', () => {
    expect(count('update_view_duration')).toBe(1)
  })

  test('Last left is stamped once, and the metric counts once', async () => {
    expect(count('mark_document_connection_closed')).toBe(1)
    expect((await stamped()) - stampedBefore).toBe(1)
  })
})
