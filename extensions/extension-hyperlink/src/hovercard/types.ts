import type { Editor } from '@tiptap/core'

import type { LinkIconResolver } from '../link-icons/types'

export interface HovercardData {
  /** The built-in card shows "No preview for this page." without it. */
  title?: string
  description?: string
  image?: { url: string }
}

/** What `fetchMetadata` gets. */
export interface HovercardContext {
  href: string
  editor: Editor
}

/** What `shouldShow` gets. */
export interface HovercardShowContext {
  href: string
  link: HTMLAnchorElement
}

export interface HovercardOptions<D extends HovercardData = HovercardData> {
  /**
   * Returns the card data. With no answer at 500 ms the card opens in the `loading` state.
   * `null` or a rejection shows no card before it opens; after, it shows the `empty` state.
   */
  fetchMetadata: (ctx: HovercardContext) => Promise<D | null>
  /** The built-in card's site icon. Same contract as `linkIcon`: a fresh element with no text, or null. */
  siteIcon?: LinkIconResolver
  shouldShow?: (ctx: HovercardShowContext) => boolean
  /**
   * Draws the card content. `null` keeps the built-in card for this state.
   * Method syntax lets host data with required fields assign to `HyperlinkOptions['hovercard']`.
   */
  render?(ctx: HovercardRenderContext<D>): HTMLElement | HovercardView | null
}

export type HovercardRenderContext<D extends HovercardData = HovercardData> = {
  href: string
  link: HTMLAnchorElement
  editor: Editor
  /** Hides this link's card if it is open, then opens through the read gate and `navigate`. */
  open: (newTab: boolean) => void
  /** Copies `href`; resolves `false` on failure. */
  copy: () => Promise<boolean>
  /**
   * Swaps the link text for `data.title`, then hides the card; answers whether it did. Set only in
   * the `data` state, when the editor is editable, the text is the link's own URL and the title
   * passes the paste-title rules.
   */
  applyTitle?: () => boolean
} & ({ state: 'loading' | 'empty' } | { state: 'data'; data: D })

export interface HovercardView {
  element: HTMLElement
  /**
   * Runs when the engine swaps this content out, drops a pending open, or closes the card.
   * On a close it runs after the card has left the DOM, at the end of the exit fade.
   */
  destroy?: () => void
}
