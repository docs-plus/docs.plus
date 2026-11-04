import type { Editor } from '@tiptap/core'

export interface PasteTitleOptions {
  /**
   * Returns the page title, or `null` to keep the URL. A throw, a rejection or no answer
   * within 4 s also keeps the URL.
   */
  fetchTitle(ctx: PasteTitleContext): Promise<string | null>
  /** Runs before any request. `false` skips this paste, for example when a user setting is off. */
  shouldFetch?(ctx: { href: string; editor: Editor }): boolean
}

export interface PasteTitleContext {
  /** The stored href, after normalizing and every URL gate. Never the raw clipboard text. */
  href: string
  editor: Editor
  /**
   * Aborts whenever the job ends, after a good answer too: at the deadline, on a drop and on
   * destroy. Do not pass it to a request that other callers share.
   */
  signal: AbortSignal
}
