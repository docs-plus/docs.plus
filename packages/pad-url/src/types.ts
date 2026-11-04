export type FilterMode = 'or' | 'and'

/** A chat room by a channel id or a heading id; the link does not say which (#402). */
export type PadChat = { linkId: string; messageId?: string }

/** A place a link points to. `format` builds it from the pad base, with no live state. */
export type PadTarget =
  | { kind: 'document'; slug?: string }
  | { kind: 'heading'; headingId: string }
  | ({ kind: 'chat' } & PadChat)

/** What an address opens. History is not here: it is a client hash or a server-only `?version=`. */
export type PadPlace =
  | { kind: 'document' }
  | { kind: 'heading'; headingId: string }
  | ({ kind: 'chat' } & PadChat)
  | { kind: 'filter'; terms: string[]; mode: FilterMode }

/** One change to this tab's address bar. The kind picks the writer. */
export type PadChange =
  | { kind: 'heading'; headingId: string; entry?: 'push' }
  | { kind: 'focus'; headingId: string; term: string }
  | { kind: 'filterAdd'; term: string }
  | { kind: 'filterRemove'; term: string }
  | { kind: 'filterMode'; mode: FilterMode }
  | { kind: 'filterReset' }
  | { kind: 'filterOpen'; href: string }
  | { kind: 'chatClosed'; headingId: string | null }

/** What an address says. Old forms (`%20` terms, `?act=ch`) read as the current ones. */
export type PadFacets = {
  sameOrigin: boolean
  slug: string
  /** pathname + search + hash */
  path: string
  /** Decoded once; case kept. */
  terms: string[]
  mode: FilterMode | null
  /** `id=`. The cosmetic `h=` trail is never read. */
  headingId: string | null
  chat: PadChat | null
  /** `?open_heading_chat=`: the composer return after sign-in. */
  signInChat: string | null
  hash: string
}

export type PadWriter = 'keepState' | 'pushBlank' | 'routerPush' | 'routerReplace'

export type PadWrite = { to: string; writer: PadWriter }

/** `null` or empty when there is no trail, so the link carries `id=` only. */
export type TrailOf = (headingId: string) => string | null

/** What `plan` reads: the live address, so a change keeps the reader's filter, chat and hash. */
export type PadUrlContext = {
  origin: string
  /** The address to plan from; the webapp passes `window.location`. */
  live: string
  trailOf: TrailOf
}

/** What `format` reads: the pad base only, so no live filter, chat or heading state leaks in. */
export type PadLinkContext = {
  /** The pad a target names, unless a `document` target names its own. */
  slug: string
  /** Without it, the link is a root-relative path. */
  origin?: string
  /** Absent means no trail. */
  trailOf?: TrailOf
}
