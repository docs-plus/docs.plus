import type { Editor } from '@tiptap/core'
import type { PadFacets, PadPlace } from '@types'
import type { IconType } from 'react-icons'

export type HyperlinkSurface = 'pad' | 'composer'

export type DocSelectionRange = { from: number; to: number }

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingSuggestion {
  kind: 'heading'
  id: string
  title: string
  level: HeadingLevel
}

export interface BookmarkSuggestion {
  kind: 'bookmark'
  id: string
  title: string
  messageId: string
  channelId: string
  archived: boolean
  createdAt: string
}

export type Suggestion = HeadingSuggestion | BookmarkSuggestion

export interface FilterArgs {
  query: string
  headings: HeadingSuggestion[]
  bookmarks: BookmarkSuggestion[]
}

export interface FilterResult {
  headings: HeadingSuggestion[]
  bookmarks: BookmarkSuggestion[]
}

export type SuggestionPanel = 'collapsed' | 'browsing' | 'searching'

export interface LinkSuggestionState {
  panel: SuggestionPanel
  query: string
  totalRows: number
  highlightIndex: number | null
  /** No-ops BACK on mobile where the picker is always-on. */
  defaultPanel: SuggestionPanel
}

export type LinkSuggestionAction =
  | { type: 'EXPAND' }
  | { type: 'BACK' }
  | { type: 'QUERY_CHANGE'; query: string }
  | { type: 'SET_TOTAL_ROWS'; total: number }
  | { type: 'SET_HIGHLIGHT'; index: number | null }
  | { type: 'HIGHLIGHT_NEXT' }
  | { type: 'HIGHLIGHT_PREV' }
  | { type: 'HIGHLIGHT_FIRST' }
  | { type: 'HIGHLIGHT_LAST' }

export type HyperlinkMode = 'create' | 'edit'
export type HyperlinkVariant = 'desktop' | 'mobile'

export interface HyperlinkResult {
  href: string
  text?: string
}

export interface HyperlinkEditorProps {
  mode: HyperlinkMode
  variant: HyperlinkVariant
  editor: Editor
  initialHref: string
  initialText?: string
  validate?: (url: string) => boolean
  defaultSuggestionsState: 'collapsed' | 'browsing'
  onApply: (result: HyperlinkResult) => boolean | void
  onBack?: () => void
  onClose: () => void
}

export interface UseHyperlinkSuggestionsArgs {
  editor: Editor
  query: string
  /** When true, bookmark RPCs are gated. */
  disabled?: boolean
}

export interface UseHyperlinkSuggestionsResult extends FilterResult {
  isLoading: boolean
  isError: boolean
}

export interface UseLinkSuggestionStateArgs {
  defaultPanel: SuggestionPanel
}

export interface UseLinkSuggestionStateResult {
  state: LinkSuggestionState
  dispatch: (action: LinkSuggestionAction) => void
  expand: () => void
  back: () => void
  setQuery: (q: string) => void
  setTotalRows: (n: number) => void
  setHighlight: (index: number | null) => void
  highlightNext: () => void
  highlightPrev: () => void
  highlightFirst: () => void
  highlightLast: () => void
}

export interface SuggestionRowProps {
  id: string
  suggestion: Suggestion
  selected: boolean
  onPick: (s: Suggestion) => void
  onMouseEnter?: () => void
  rowPadClass: string
  rowInsetPx: number
}

export interface HyperlinkSuggestionsProps {
  panel: SuggestionPanel
  headings: HeadingSuggestion[]
  bookmarks: BookmarkSuggestion[]
  highlightIndex: number | null
  isLoading: boolean
  onPick: (s: Suggestion) => void
  onExpand: () => void
  onBack?: () => void
  onRowHover: (index: number) => void
  rowIdPrefix: string
  variant?: HyperlinkVariant
}

export interface ActivePopover {
  host: HTMLElement
  props: Omit<HyperlinkEditorProps, 'variant'>
}

export interface ApplyHyperlinkArgs {
  href: string
  text?: string
}

/** Optional command behavior; pad paths default `focus: true`. */
export interface ApplyHyperlinkCommandOpts {
  focus?: boolean
}

/**
 * A place in a pad: this one, or another. The `filter` variant carries the original
 * href, so `run` opens it with `padUrl.go({ kind: 'filterOpen' })`.
 */
export type InternalDocumentLink =
  | Exclude<PadPlace, { kind: 'filter' }>
  | (Extract<PadPlace, { kind: 'filter' }> & { href: string })
  | { kind: 'history'; version: number | null }

/**
 * A metadata answer as the cache holds it. `image.url` is already our image route, so no
 * caller can reach the linked site's own image URL. `url` is the server's canonical page URL.
 * `fallback` marks the server's host-only card: `title` is then just the host.
 */
export interface LinkCard {
  url: string
  title: string
  description?: string
  image?: { url: string }
  fallback?: true
  /** Why the fallback card has no preview. An older server sends none. */
  miss?: LinkMiss
  /** The server got a file, not a page (`media_type: 'document'`): the title is only its name. */
  file?: true
  kind?: 'repo'
  facts?: LinkFact[]
}

/** Keep in step with the server's fallback `miss` values. */
export const LINK_MISSES = ['blocked', 'no-preview', 'unreachable'] as const

export type LinkMiss = (typeof LINK_MISSES)[number]

/** The site a link's text names, and the different site the link opens. */
export interface LinkTextMismatch {
  says: string
  opens: string
}

/** What a web card with no preview draws: a title, the address under it, and the reason. */
export interface NoPreviewView {
  title: string
  path: string
  reason: string
}

/** The glyphs the web link card can draw before a fact. Keep in step with the server's `FACT_ICONS`. */
export const LINK_FACT_ICONS = [
  'location',
  'work',
  'posted',
  'stars',
  'language',
  'updated',
  'answers',
  'accepted'
] as const

export type LinkFactIcon = (typeof LINK_FACT_ICONS)[number]

/** One short line in the row under the title, such as a place or a star count. */
export interface LinkFact {
  icon: LinkFactIcon
  text: string
}

/** What the web link card draws. A page with no title gets the no-preview card instead. */
export type WebCardData = Pick<LinkCard, 'description' | 'image' | 'kind' | 'facts'> & {
  title: string
}

/** Where a link goes from the open pad: a place in it, another pad, a web page, or an app scheme. */
export type LinkDestination =
  | { kind: 'here'; link: InternalDocumentLink }
  | { kind: 'pad'; pad: PadFacets }
  | { kind: 'web' }
  | { kind: 'other' }

/** A docs.plus link: the ones that get the webapp's pad card. */
export type PadLink = Extract<LinkDestination, { kind: 'pad' | 'here' }>

export interface InternalLinkDescriptor {
  label: string
  sublabel: string
  icon: IconType
  /** Name for the Go button; the visible label alone is too short to tell links apart. */
  accessibleName: string
  /** Filter links only. */
  modeLabel?: 'Match all' | 'Match any'
}

export interface InternalLinkChipProps {
  link: InternalDocumentLink
  editor: Editor | null
  /** Filter links only: the composer dialog leaves out "In this document". */
  hideFilterSublabel?: boolean
}
