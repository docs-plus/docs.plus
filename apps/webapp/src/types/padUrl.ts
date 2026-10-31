export type FilterMode = 'or' | 'and'

/** A chat room by a channel id or a heading id; `openChatFromLink` tells them apart (#402). */
export type PadChat = { linkId: string; messageId?: string }

/** A place a link points to. `padUrl.link` builds it from the pad base, with no live state. */
export type PadTarget =
  | { kind: 'document'; slug?: string }
  | { kind: 'heading'; headingId: string }
  | ({ kind: 'chat' } & PadChat)

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

export type PadUrlContext = {
  origin: string
  /** The live address, read from `window.location`, never from `router.asPath`. */
  live: string
  /** `null` when there is no editor, so the link carries `id=` only. */
  trailOf(headingId: string): string | null
}
