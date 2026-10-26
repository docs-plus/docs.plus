/** What linkIcon receives. One field today; new fields are additive. */
export interface LinkIconContext {
  href: string
}

/** Sync. A fresh element with no text, or null for a plain link. */
export type LinkIconResolver = (ctx: LinkIconContext) => HTMLElement | null

/** Map entry: an image URL, a { light, dark } URL pair, or an element factory. */
export type LinkIconSource = string | { light: string; dark: string } | (() => HTMLElement)

export interface LinkIconFetcherOptions {
  /** Builds the image URL for one origin, for example your favicon route. */
  src: (origin: string) => string
  /** Light tile behind each fetched icon on a dark color-scheme. Default false. */
  tile?: boolean
}
