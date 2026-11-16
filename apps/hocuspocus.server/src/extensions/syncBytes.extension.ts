import type { beforeSyncPayload, Extension, onDisconnectPayload } from '@hocuspocus/server'

import { wsSyncMessageBytes, wsSyncWindowBytes } from '../lib/metrics'

const WINDOW_SECONDS = 60

/**
 * Per-connection sync bytes over a sliding 60 s window, in one-second buckets (#659 phase 1).
 * Measure only: nothing refuses or closes. The phase 2 refusal compares this same rolling sum.
 */
export type SyncWindow = {
  bytes: number[]
  second: number[]
  periodStart: number
  peak: number
}
type SyncContext = { syncWindow?: SyncWindow }

const rollingSum = (w: SyncWindow, nowSecond: number): number => {
  let sum = 0
  for (let i = 0; i < WINDOW_SECONDS; i++) {
    if (nowSecond - w.second[i] < WINDOW_SECONDS) sum += w.bytes[i]
  }
  return sum
}

/**
 * Adds one message and returns the peak rolling sum of the minute it closed, or null.
 * One peak per connection per minute keeps the histogram count to one sample a minute.
 */
export const chargeSyncWindow = (
  context: SyncContext,
  nowMs: number,
  bytes: number
): number | null => {
  const nowSecond = Math.floor(nowMs / 1000)
  let w = context.syncWindow
  if (!w) {
    w = {
      bytes: new Array(WINDOW_SECONDS).fill(0),
      second: new Array(WINDOW_SECONDS).fill(-Infinity),
      periodStart: nowMs,
      peak: 0
    }
    context.syncWindow = w
  }
  const slot = nowSecond % WINDOW_SECONDS
  if (w.second[slot] !== nowSecond) {
    w.second[slot] = nowSecond
    w.bytes[slot] = 0
  }
  w.bytes[slot] += bytes
  const sum = rollingSum(w, nowSecond)

  if (nowMs - w.periodStart < WINDOW_SECONDS * 1000) {
    w.peak = Math.max(w.peak, sum)
    return null
  }
  const closed = w.peak
  w.periodStart = nowMs
  w.peak = sum
  return closed
}

/** Takes the open peak once: Hocuspocus 3.4.4 runs onDisconnect twice for one close (#601). */
export const endSyncWindow = (context: SyncContext | undefined): number | null => {
  const w = context?.syncWindow
  if (!context || !w) return null
  delete context.syncWindow
  return w.peak
}

export const syncBytesExtension: Extension = {
  // Not awaited by MessageReceiver, so this hook must never throw.
  async beforeSync({ payload, context }: beforeSyncPayload) {
    const bytes = payload.byteLength
    wsSyncMessageBytes.observe(bytes)
    const closed = chargeSyncWindow(context, Date.now(), bytes)
    if (closed !== null) wsSyncWindowBytes.observe(closed)
  },

  async onDisconnect({ context }: onDisconnectPayload) {
    const peak = endSyncWindow(context)
    if (peak !== null) wsSyncWindowBytes.observe(peak)
  }
}
