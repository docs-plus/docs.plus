// Pure on purpose: `hocuspocus.server.ts` imports `queue.ts`, which opens Redis
// at import, so no test can load the gate there. This module imports nothing.

// A refused watch used to make the client evict the row and ask for the next
// one, which walks the list. The cap still refuses, and the client stops.
export const WATCH_WINDOW_MS = 10_000
export const WATCH_MAX = 8
// Just below three base64 frames of the largest stored head (5.4 MB raw).
// Provisional: #602 may change it.
export const WATCH_MAX_BYTES = 20 * 1024 * 1024

type WatchSpend = { times: number[]; charges: { at: number; bytes: number }[] }

// Keyed per connection, so one visitor cannot spend another's budget.
const spends = new WeakMap<object, WatchSpend>()

const spendOf = (key: object): WatchSpend => {
  let spend = spends.get(key)
  if (!spend) {
    spend = { times: [], charges: [] }
    spends.set(key, spend)
  }
  return spend
}

export const watchOverBudget = (key: object, now: number): boolean => {
  const spend = spendOf(key)
  spend.times = spend.times.filter((at) => now - at < WATCH_WINDOW_MS)
  if (spend.times.length >= WATCH_MAX) return true
  spend.times.push(now)
  return false
}

/**
 * Checks and charges in one synchronous call, so frames sent without waiting
 * cannot all pass before any is charged. The first frame in an empty window is
 * always admitted, so one normal watch is served even past the budget.
 */
export const admitWatchBytes = (key: object, now: number, encodedBytes: number): boolean => {
  const spend = spendOf(key)
  spend.charges = spend.charges.filter((charge) => now - charge.at < WATCH_WINDOW_MS)
  const spent = spend.charges.reduce((total, charge) => total + charge.bytes, 0)
  if (spent > 0 && spent + encodedBytes > WATCH_MAX_BYTES) return false
  spend.charges.push({ at: now, bytes: encodedBytes })
  return true
}
