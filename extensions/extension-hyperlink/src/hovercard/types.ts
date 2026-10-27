import type { LinkIconContext } from '../link-icons/types'

/** `cover` always fills the card. `adaptive` shrinks near-square or small pictures to a thumb. */
export type HovercardImageLayout = 'cover' | 'adaptive'

export interface HovercardData {
  title: string
  description?: string
  image?: { url: string; width?: number; height?: number }
}

export interface HovercardOptions {
  /** Returns the card data, or null to show no card. */
  fetchMetadata: (ctx: { href: string }) => Promise<HovercardData | null>
  /** Same contract as `linkIcon`: a fresh element with no text, or null. */
  siteIcon?: (ctx: LinkIconContext) => HTMLElement | null
  shouldShow?: (ctx: { href: string; link: HTMLAnchorElement }) => boolean
  imageLayout?: HovercardImageLayout
}
