/** Bytes by key, least recently used out first. A key holds a server-computed version, so it never goes stale. */
export const createPngCache = (maxBytes: number) => {
  const entries = new Map<string, Uint8Array<ArrayBuffer>>()
  let bytes = 0
  return {
    get(key: string): Uint8Array<ArrayBuffer> | undefined {
      const png = entries.get(key)
      if (png) {
        entries.delete(key)
        entries.set(key, png)
      }
      return png
    },
    set(key: string, png: Uint8Array<ArrayBuffer>): void {
      if (png.byteLength > maxBytes || entries.has(key)) return
      entries.set(key, png)
      bytes += png.byteLength
      for (const [oldKey, old] of entries) {
        if (bytes <= maxBytes) break
        entries.delete(oldKey)
        bytes -= old.byteLength
      }
    }
  }
}

export const SHED = Symbol('shed')

/**
 * One render at a time, with a short queue. Two slots on one CPU doubled event-loop lag for no
 * extra throughput. A full queue sheds at once: the crawler gets the short-cached Fallback card
 * now, and the real card on a later fetch.
 */
export const createRenderSlot = (queueLimit: number) => {
  let busy = false
  const waiting: (() => void)[] = []
  return async <T>(work: () => Promise<T>): Promise<T | typeof SHED> => {
    if (busy) {
      if (waiting.length >= queueLimit) return SHED
      await new Promise<void>((resolve) => waiting.push(resolve))
    }
    busy = true
    try {
      return await work()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else busy = false
    }
  }
}

/** Concurrent calls for one key share one promise. Nothing is kept after it settles. */
export const createSingleFlight = <T>() => {
  const pending = new Map<string, Promise<T>>()
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key)
    if (existing) return existing
    const started = load().finally(() => pending.delete(key))
    pending.set(key, started)
    return started
  }
}

export type GuardOutcome = 'memo' | 'joined' | 'shed' | 'error'

/**
 * The guards a card read keeps off page latency: a memo, one query per key, then a cap. The
 * memo is checked first, then the client, then the cap. Only an answer `keep` accepts is
 * remembered, so a shed, a missing client or a failed read is never kept.
 */
export const createGuardedRead = <C, T>(opts: {
  getClient: () => C | null
  cap: number
  memoMs: number
  memoMax: number
  keep: (value: T) => boolean
  // What a full cap and a missing client answer.
  shed: T
  noClient: T
  count: (outcome: GuardOutcome) => void
  startTimer: () => () => void
}) => {
  const memo = new Map<string, { at: number; value: T }>()
  let inFlight = 0
  const shared = createSingleFlight<T>()

  const remember = (key: string, value: T) => {
    memo.delete(key)
    memo.set(key, { at: Date.now(), value })
    // Insertion order makes the first key the oldest.
    if (memo.size > opts.memoMax) memo.delete(memo.keys().next().value as string)
  }

  const run = async (key: string, client: C, load: (client: C) => Promise<T>): Promise<T> => {
    if (inFlight >= opts.cap) {
      opts.count('shed')
      return opts.shed
    }
    inFlight++
    const stop = opts.startTimer()
    try {
      const value = await load(client)
      if (opts.keep(value)) remember(key, value)
      return value
    } finally {
      stop()
      inFlight--
    }
  }

  return async (key: string, load: (client: C) => Promise<T>): Promise<T> => {
    const hit = memo.get(key)
    if (hit && Date.now() - hit.at < opts.memoMs) {
      opts.count('memo')
      return hit.value
    }
    const client = opts.getClient()
    if (!client) {
      opts.count('error')
      return opts.noClient
    }
    let joined = true
    const result = await shared(key, () => {
      joined = false
      return run(key, client, load)
    })
    if (joined) opts.count('joined')
    return result
  }
}
