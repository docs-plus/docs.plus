/** A held slot. Calling it more than once frees the slot only once. */
export type Release = () => void

export interface Admission {
  /** A slot, or null when `max` cold requests are already in flight. */
  tryAcquire: () => Release | null
  inFlight: () => number
}

export const createAdmission = (max: number): Admission => {
  let held = 0
  return {
    tryAcquire: () => {
      if (held >= max) return null
      held += 1
      let released = false
      return () => {
        if (released) return
        released = true
        held -= 1
      }
    },
    inFlight: () => held
  }
}

/**
 * Cold work per process: what runs after the cache read on the metadata, image, icon and
 * archive routes (#787). With no bound, a flood past one CPU grew the queue until the 512M
 * container was OOM-killed. A driver bound of 16 to 64 kept memory flat at the CPU plateau.
 */
export const COLD_WORK_MAX = 64
export const coldWork = createAdmission(COLD_WORK_MAX)
