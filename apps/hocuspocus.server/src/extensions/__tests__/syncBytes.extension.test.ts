import { describe, expect, it } from 'bun:test'

import { chargeSyncWindow, endSyncWindow, type SyncWindow } from '../syncBytes.extension'

type Ctx = { syncWindow?: SyncWindow }
const T0 = 1_000_000_000

describe('chargeSyncWindow', () => {
  it('keeps one rolling sum across a minute boundary that a fixed window would split', () => {
    const ctx: Ctx = {}
    chargeSyncWindow(ctx, T0, 1) // the minute opens
    chargeSyncWindow(ctx, T0 + 50_000, 400)
    // 70 s: the minute closes, and its peak is 401.
    expect(chargeSyncWindow(ctx, T0 + 70_000, 500)).toBe(401)
    // 400 (at 50 s) and 500 (at 70 s) are 20 s apart, so the rolling sum holds both.
    expect(ctx.syncWindow?.peak).toBe(900)
  })

  it('drops bytes older than 60 s from the rolling sum', () => {
    const ctx: Ctx = {}
    chargeSyncWindow(ctx, T0, 300)
    chargeSyncWindow(ctx, T0 + 30_000, 100)
    // 61 s: the 300 at 0 s has left the window; this message closes the first minute.
    expect(chargeSyncWindow(ctx, T0 + 61_000, 5)).toBe(400)
    expect(ctx.syncWindow?.peak).toBe(105)
  })

  it('reuses a bucket slot one minute later without keeping its old bytes', () => {
    const ctx: Ctx = {}
    chargeSyncWindow(ctx, T0, 1000)
    chargeSyncWindow(ctx, T0 + 60_000, 7) // same slot, next minute
    chargeSyncWindow(ctx, T0 + 60_500, 3)
    expect(ctx.syncWindow?.peak).toBe(10)
  })
})

describe('endSyncWindow', () => {
  it('returns the open peak once, so a second onDisconnect records nothing', () => {
    const ctx: Ctx = {}
    chargeSyncWindow(ctx, T0, 42)
    expect(endSyncWindow(ctx)).toBe(42)
    expect(endSyncWindow(ctx)).toBeNull()
  })
})
