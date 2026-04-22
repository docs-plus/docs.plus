// Single source of truth for the hyperlink command surface.
// `HyperlinkPublicCommands<R>` declares both the Tiptap module
// augmentation and the runtime contract via the mapped
// `HyperlinkRawCommands` type below — drift is a compile error.

import type { CommandProps } from '@tiptap/core'

import type { HyperlinkAttributes } from '../hyperlink'

export type SetHyperlinkAttributes = {
  href: string
  target?: string | null
  title?: string | null
  image?: string | null
} & Record<string, unknown>

export type EditHyperlinkAttributes = {
  newText?: string
  newURL?: string
  title?: string
  image?: string
}

export interface HyperlinkPublicCommands<ReturnType> {
  /** Write the hyperlink mark; returns `false` when `href` is missing or fails the gate. See README → Commands. */
  setHyperlink: (attributes: SetHyperlinkAttributes) => ReturnType
  /** Remove the hyperlink mark from the current selection. */
  unsetHyperlink: () => ReturnType
  /** Toggle the hyperlink mark; same gates as `setHyperlink`. */
  toggleHyperlink: (attributes: SetHyperlinkAttributes) => ReturnType
  /** Open the create popover anchored to the selection; no-op without a `popovers.createHyperlink` factory. */
  openCreateHyperlinkPopover: (attributes?: Partial<HyperlinkAttributes>) => ReturnType
  editHyperlinkText: (text: string) => ReturnType
  editHyperlinkHref: (href: string) => ReturnType
  editHyperlink: (attributes?: EditHyperlinkAttributes) => ReturnType
  /** Migration alias for `setHyperlink` (drop-in `@tiptap/extension-link` compat). */
  setLink: (attributes: SetHyperlinkAttributes) => ReturnType
  /** Migration alias for `unsetHyperlink`. */
  unsetLink: () => ReturnType
  /** Migration alias for `toggleHyperlink`. */
  toggleLink: (attributes: SetHyperlinkAttributes) => ReturnType
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hyperlink: HyperlinkPublicCommands<ReturnType>
  }
}

// Spelt explicitly (not pulled from `@tiptap/core`'s `RawCommands`)
// so the mapped type below can pin the public-to-runtime relationship.
type CommandFactory<Args extends unknown[]> = (...args: Args) => (props: CommandProps) => boolean

/** Runtime contract; adding a `HyperlinkPublicCommands` key without an impl is a compile error. */
export type HyperlinkRawCommands = {
  [K in keyof HyperlinkPublicCommands<unknown>]: HyperlinkPublicCommands<unknown>[K] extends (
    ...args: infer A
  ) => unknown
    ? CommandFactory<A>
    : never
}
