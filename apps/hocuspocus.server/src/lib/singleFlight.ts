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
