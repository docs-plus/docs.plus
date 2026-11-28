export const LARGE_DECODE_BYTES = 4 * 1024 * 1024
export const LARGE_DECODE_WAIT_MS = 10_000

export type LargeDecodeOutcome = 'run' | 'waited' | 'refused'

type Waiter = (release: () => void) => void

let held = false
const waiters: Waiter[] = []

const createRelease = (): (() => void) => {
  let released = false
  return () => {
    if (released) return
    released = true
    const next = waiters.shift()
    if (next) next(createRelease())
    else held = false
  }
}

/**
 * One large decode per process to cap rest-api burst RSS (#754).
 * Below `LARGE_DECODE_BYTES`, returns a no-op release at once. Above it, callers
 * take the slot in FIFO order or get `null` after `waitMs`; release is idempotent.
 */
export const acquireLargeDecode = (
  bytes: number,
  waitMs = LARGE_DECODE_WAIT_MS,
  onOutcome?: (outcome: LargeDecodeOutcome) => void
): Promise<(() => void) | null> => {
  if (bytes < LARGE_DECODE_BYTES) return Promise.resolve(() => {})
  if (!held) {
    held = true
    onOutcome?.('run')
    return Promise.resolve(createRelease())
  }
  if (waitMs <= 0) {
    onOutcome?.('refused')
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const waiter: Waiter = (release) => {
      clearTimeout(timer)
      onOutcome?.('waited')
      resolve(release)
    }
    const timer = setTimeout(() => {
      const idx = waiters.indexOf(waiter)
      if (idx !== -1) waiters.splice(idx, 1)
      onOutcome?.('refused')
      resolve(null)
    }, waitMs)
    waiters.push(waiter)
  })
}
