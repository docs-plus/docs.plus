import { normalizeSlug } from './slug'

/**
 * Hides a pad's cached link cards when its access narrows. `src/index.ts` binds it to
 * link-metadata's `forgetPad`. Unbound, as in the worker, it does nothing.
 */
type ForgetPad = (slugKey: string) => Promise<void>

let forgetPad: ForgetPad | null = null

export const setPadCardForgetter = (fn: ForgetPad | null): void => {
  forgetPad = fn
}

/** Best-effort. A write calls it after its commit and never awaits it; it never rejects. */
export const forgetPadCards = async (slug: string): Promise<void> => {
  if (!forgetPad) return
  try {
    await forgetPad(normalizeSlug(slug))
  } catch {
    // `forgetPad` logs its own failures; this only keeps a bad slug from reaching the write.
  }
}
