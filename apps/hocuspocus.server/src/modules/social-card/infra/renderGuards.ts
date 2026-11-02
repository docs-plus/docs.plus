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
 * extra throughput. A crawler keeps a static image for weeks, so a full queue sheds at once.
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
