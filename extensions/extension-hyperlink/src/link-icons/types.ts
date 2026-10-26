/** What linkIcon receives. One field today; new fields are additive. */
export interface LinkIconContext {
  href: string
}

/** Sync. A fresh element with no text, or null for a plain link. */
export type LinkIconResolver = (ctx: LinkIconContext) => HTMLElement | null
