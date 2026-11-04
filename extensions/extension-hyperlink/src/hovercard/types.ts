import type { LinkIconResolver } from '../link-icons/types'

/** `cover` fills the card; `thumb` sits after the text; `tile` is a repo owner picture before it. Internal. */
export type ImageShape = 'cover' | 'thumb' | 'tile'

/** `cover` always fills the card. `adaptive` shrinks near-square or small pictures to a thumb. */
export type HovercardImageLayout = 'cover' | 'adaptive'

/** The glyph before one fact. */
export type HovercardFactIcon =
  'location' | 'work' | 'posted' | 'stars' | 'language' | 'updated' | 'answers' | 'accepted'

/** One short line in the row under the title, such as a place or a star count. */
export interface HovercardFact {
  icon: HovercardFactIcon
  text: string
}

export interface HovercardData {
  /** Absent means the page shares no preview: the card shows one line and the link line. */
  title?: string
  description?: string
  image?: { url: string; width?: number; height?: number }
  /** `repo` draws a square picture as a small owner tile before the title. */
  kind?: 'repo'
  facts?: HovercardFact[]
}

export interface HovercardOptions {
  /**
   * Returns the card data. With no answer at 500 ms the card opens with loading bars.
   * `null` or a rejection shows no card before it opens; after, it shows "No preview for this page."
   */
  fetchMetadata: (ctx: { href: string }) => Promise<HovercardData | null>
  /** Same contract as `linkIcon`: a fresh element with no text, or null. */
  siteIcon?: LinkIconResolver
  shouldShow?: (ctx: { href: string; link: HTMLAnchorElement }) => boolean
  imageLayout?: HovercardImageLayout
}
