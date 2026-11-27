export const LARGE_DECODE_BYTES = 4 * 1024 * 1024
export const LARGE_DECODE_WAIT_MS = 10_000

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
 * One large decode per process, because rest-api has 512 MiB. Below
 * `LARGE_DECODE_BYTES` the release is a no-op at once. Above it, callers take
 * the one slot in FIFO order, or get `null` after `waitMs`. Release is idempotent.
 */
export const acquireLargeDecode = (
  bytes: number,
  waitMs = LARGE_DECODE_WAIT_MS
): Promise<(() => void) | null> => {
  if (bytes < LARGE_DECODE_BYTES) return Promise.resolve(() => {})
  if (!held) {
    held = true
    return Promise.resolve(createRelease())
  }
  if (waitMs <= 0) return Promise.resolve(null)

  return new Promise((resolve) => {
    const waiter: Waiter = (release) => {
      clearTimeout(timer)
      resolve(release)
    }
    const timer = setTimeout(() => {
      const idx = waiters.indexOf(waiter)
      if (idx !== -1) waiters.splice(idx, 1)
      resolve(null)
    }, waitMs)
    waiters.push(waiter)
  })
}
