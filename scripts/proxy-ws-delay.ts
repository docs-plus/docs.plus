import { parseArgs } from 'node:util'

interface ProxyConfig {
  listenHost: string
  listenPort: number
  targetHost: string
  targetPort: number
  delayMs: number
  verbose: boolean
}

interface QueuedChunk {
  data: Uint8Array
  deliverAt: number
  isWsPayload: boolean
}

type DirName = 'c2s' | 's2c'
const DIR_NAMES: readonly DirName[] = ['c2s', 's2c']

interface DirectionState {
  upgraded: boolean
  handshakeBuf: Uint8Array
  queue: QueuedChunk[]
  pendingOffset: number
  waitingForDrain: boolean
  timer: ReturnType<typeof setTimeout> | null
  timerDeliverAt: number | null
  sourceEnded: boolean
  targetEnded: boolean
  chunks: number
  bytes: number
}

interface SocketData {
  connId: number
}

type ProxySocket = Bun.Socket<SocketData>

interface ConnState {
  id: number
  client: ProxySocket | null
  upstream: ProxySocket | null
  closed: boolean
  dirs: Record<DirName, DirectionState>
}

const EMPTY_BYTES = new Uint8Array(0)
const MAX_HANDSHAKE_BYTES = 64 * 1024

function printHelp(): void {
  console.log(`Usage: bun scripts/proxy-ws-delay.ts [options]

Options:
  --listen-host <host>  Bind host (default: 127.0.0.1)
  --listen-port <port>  Bind port (default: 4001)
  --target-host <host>  Upstream host (default: 127.0.0.1)
  --target-port <port>  Upstream port (default: 4011)
  --delay-ms <ms>       One-way delay in ms after WS upgrade (default: 1000)
  --verbose             Log connection and chunk forwarding events
  -h, --help            Show this help`)
}

function parsePort(raw: string, flag: string): number {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid ${flag} value: ${raw}`)
  }
  return parsed
}

function parseNonNegativeInt(raw: string, flag: string): number {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flag} value: ${raw}`)
  }
  return parsed
}

function parseCli(): ProxyConfig {
  const { values } = parseArgs({
    options: {
      'listen-host': { type: 'string', default: '127.0.0.1' },
      'listen-port': { type: 'string', default: '4001' },
      'target-host': { type: 'string', default: '127.0.0.1' },
      'target-port': { type: 'string', default: '4011' },
      'delay-ms': { type: 'string', default: '1000' },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    },
    strict: true
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  return {
    listenHost: values['listen-host'],
    listenPort: parsePort(values['listen-port'], '--listen-port'),
    targetHost: values['target-host'],
    targetPort: parsePort(values['target-port'], '--target-port'),
    delayMs: parseNonNegativeInt(values['delay-ms'], '--delay-ms'),
    verbose: values.verbose
  }
}

function createDirectionState(): DirectionState {
  return {
    upgraded: false,
    handshakeBuf: EMPTY_BYTES,
    queue: [],
    pendingOffset: 0,
    waitingForDrain: false,
    timer: null,
    timerDeliverAt: null,
    sourceEnded: false,
    targetEnded: false,
    chunks: 0,
    bytes: 0
  }
}

function clearDirTimer(dir: DirectionState): void {
  if (dir.timer !== null) {
    clearTimeout(dir.timer)
    dir.timer = null
    dir.timerDeliverAt = null
  }
}

function getTargetSocket(state: ConnState, dirName: DirName): ProxySocket | null {
  return dirName === 'c2s' ? state.upstream : state.client
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const merged = new Uint8Array(a.length + b.length)
  merged.set(a, 0)
  merged.set(b, a.length)
  return merged
}

function findHeaderEnd(buf: Uint8Array): number {
  for (let i = 0; i <= buf.length - 4; i += 1) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
      return i
    }
  }
  return -1
}

async function main(): Promise<void> {
  const config = parseCli()
  const connections = new Map<number, ConnState>()
  let nextConnId = 1
  let totalConnections = 0
  const totalStats: Record<DirName, { chunks: number; bytes: number }> = {
    c2s: { chunks: 0, bytes: 0 },
    s2c: { chunks: 0, bytes: 0 }
  }
  let shuttingDown = false

  const closeConnection = (state: ConnState, reason: string): void => {
    if (state.closed) return
    state.closed = true
    for (const dirName of DIR_NAMES) {
      clearDirTimer(state.dirs[dirName])
      state.dirs[dirName].queue.length = 0
    }
    for (const sock of [state.client, state.upstream]) {
      try {
        sock?.end()
      } catch {
        // Ignore already-closed socket.
      }
    }
    connections.delete(state.id)
    if (config.verbose) {
      const { c2s, s2c } = state.dirs
      console.log(
        `[proxy #${state.id}] closed (${reason}) c2s=${c2s.chunks} chunks (${c2s.bytes} B) s2c=${s2c.chunks} chunks (${s2c.bytes} B)`
      )
    }
  }

  const flushDir = (state: ConnState, dirName: DirName): void => {
    if (state.closed) return
    const dir = state.dirs[dirName]
    const target = getTargetSocket(state, dirName)
    if (!target || dir.waitingForDrain) return

    while (dir.queue.length > 0) {
      const head = dir.queue[0]

      const now = Date.now()
      if (head.deliverAt > now) {
        if (dir.timerDeliverAt !== null && dir.timerDeliverAt <= head.deliverAt) {
          return
        }
        clearDirTimer(dir)
        dir.timerDeliverAt = head.deliverAt
        dir.timer = setTimeout(() => {
          dir.timer = null
          dir.timerDeliverAt = null
          flushDir(state, dirName)
        }, head.deliverAt - now)
        return
      }

      clearDirTimer(dir)
      const slice = dir.pendingOffset > 0 ? head.data.subarray(dir.pendingOffset) : head.data
      let written = 0
      try {
        written = target.write(slice)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        closeConnection(state, `${dirName} write error: ${message}`)
        return
      }

      if (written < slice.length) {
        dir.pendingOffset += written
        dir.waitingForDrain = true
        return
      }

      dir.queue.shift()
      dir.pendingOffset = 0
      if (head.isWsPayload) {
        dir.chunks += 1
        dir.bytes += head.data.length
        totalStats[dirName].chunks += 1
        totalStats[dirName].bytes += head.data.length
        if (config.verbose) {
          console.log(
            `[proxy #${state.id}] ${dirName} forwarded ${head.data.length} B (delay target=${config.delayMs} ms, lag=${now - head.deliverAt} ms)`
          )
        }
      }
    }

    if (dir.sourceEnded && !dir.targetEnded) {
      dir.targetEnded = true
      try {
        target.end()
      } catch {
        // Ignore already-closed target socket.
      }
    }

    const otherName: DirName = dirName === 'c2s' ? 's2c' : 'c2s'
    const other = state.dirs[otherName]
    const otherDone =
      other.queue.length === 0 && (other.sourceEnded || !getTargetSocket(state, otherName))
    if (dir.sourceEnded && dir.queue.length === 0 && otherDone) {
      closeConnection(state, 'eof')
    }
  }

  const handleIncoming = (state: ConnState, dirName: DirName, rawData: Uint8Array): void => {
    if (state.closed) return
    const copy = new Uint8Array(rawData)
    const dir = state.dirs[dirName]

    if (dir.upgraded) {
      dir.queue.push({
        data: copy,
        deliverAt: Date.now() + config.delayMs,
        isWsPayload: true
      })
      flushDir(state, dirName)
      return
    }

    dir.handshakeBuf = concatBytes(dir.handshakeBuf, copy)
    if (dir.handshakeBuf.length > MAX_HANDSHAKE_BYTES) {
      closeConnection(state, `${dirName} handshake exceeded ${MAX_HANDSHAKE_BYTES} bytes`)
      return
    }
    const headerEnd = findHeaderEnd(dir.handshakeBuf)
    if (headerEnd === -1) return

    const splitAt = headerEnd + 4
    const handshakeBytes = dir.handshakeBuf.subarray(0, splitAt)
    const trailingBytes = dir.handshakeBuf.subarray(splitAt)
    dir.handshakeBuf = EMPTY_BYTES
    dir.upgraded = true

    if (config.verbose) {
      const preview = new TextDecoder().decode(handshakeBytes).split('\r\n')[0] ?? ''
      console.log(`[proxy #${state.id}] ${dirName} upgraded: ${preview}`)
    }

    dir.queue.push({ data: handshakeBytes, deliverAt: 0, isWsPayload: false })
    if (trailingBytes.length > 0) {
      dir.queue.push({
        data: new Uint8Array(trailingBytes),
        deliverAt: Date.now() + config.delayMs,
        isWsPayload: true
      })
    }
    flushDir(state, dirName)
  }

  const handleDrain = (state: ConnState, dirName: DirName): void => {
    state.dirs[dirName].waitingForDrain = false
    flushDir(state, dirName)
  }

  const handleEnd = (state: ConnState, role: 'client' | 'upstream'): void => {
    if (state.closed) return
    const inbound: DirName = role === 'client' ? 'c2s' : 's2c'
    state.dirs[inbound].sourceEnded = true
    flushDir(state, inbound)
  }

  const handleClose = (state: ConnState, role: 'client' | 'upstream'): void => {
    if (state.closed) return
    const inbound: DirName = role === 'client' ? 'c2s' : 's2c'
    const outbound: DirName = inbound === 'c2s' ? 's2c' : 'c2s'
    if (role === 'client') state.client = null
    else state.upstream = null
    state.dirs[inbound].sourceEnded = true
    clearDirTimer(state.dirs[outbound])
    state.dirs[outbound].queue.length = 0
    if (!getTargetSocket(state, inbound) || state.dirs[inbound].queue.length === 0) {
      closeConnection(state, `${role} close`)
      return
    }
    flushDir(state, inbound)
  }

  const server = Bun.listen<SocketData>({
    hostname: config.listenHost,
    port: config.listenPort,
    socket: {
      open(clientSocket) {
        if (shuttingDown) {
          clientSocket.end()
          return
        }
        const connId = nextConnId++
        totalConnections += 1
        clientSocket.data = { connId }
        const state: ConnState = {
          id: connId,
          client: clientSocket,
          upstream: null,
          closed: false,
          dirs: { c2s: createDirectionState(), s2c: createDirectionState() }
        }
        connections.set(connId, state)

        if (config.verbose) {
          console.log(`[proxy #${connId}] client connected`)
        }

        void Bun.connect<SocketData>({
          hostname: config.targetHost,
          port: config.targetPort,
          socket: {
            open(upstreamSocket) {
              if (state.closed) {
                upstreamSocket.end()
                return
              }
              upstreamSocket.data = { connId }
              state.upstream = upstreamSocket
              flushDir(state, 'c2s')
            },
            data: (_socket, data) => handleIncoming(state, 's2c', data),
            drain: () => handleDrain(state, 'c2s'),
            end: () => handleEnd(state, 'upstream'),
            close: () => handleClose(state, 'upstream'),
            error: (_socket, err) => closeConnection(state, `upstream error: ${err.message}`)
          }
        }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          closeConnection(state, `upstream connect failed: ${message}`)
        })
      },
      data(socket, data) {
        const state = connections.get(socket.data.connId)
        if (state) handleIncoming(state, 'c2s', data)
      },
      drain(socket) {
        const state = connections.get(socket.data.connId)
        if (state) handleDrain(state, 's2c')
      },
      end(socket) {
        const state = connections.get(socket.data.connId)
        if (state) handleEnd(state, 'client')
      },
      close(socket) {
        const state = connections.get(socket.data.connId)
        if (state) handleClose(state, 'client')
      },
      error(socket, err) {
        const state = connections.get(socket.data.connId)
        if (state) closeConnection(state, `client error: ${err.message}`)
      }
    }
  })

  console.log(
    `[ws-delay-proxy] listening on ${config.listenHost}:${server.port} -> ${config.targetHost}:${config.targetPort} (delay=${config.delayMs}ms each way)`
  )

  const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(
      `[ws-delay-proxy] ${signal} received; stopping (connections=${totalConnections}, c2s=${totalStats.c2s.chunks} chunks / ${totalStats.c2s.bytes} B, s2c=${totalStats.s2c.chunks} chunks / ${totalStats.s2c.bytes} B)`
    )
    server.stop(true)
    for (const state of Array.from(connections.values())) {
      closeConnection(state, signal)
    }
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

await main()
