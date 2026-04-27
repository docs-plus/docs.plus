import type { Editor } from '@tiptap/core'

// ── Domain ────────────────────────────────────────────────────

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingSuggestion {
  kind: 'heading'
  id: string
  title: string
  level: HeadingLevel
  /** Slug ancestors (inclusive); drives indent + future deep-link. */
  breadcrumb: string[]
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

// ── Search filter ─────────────────────────────────────────────

export interface FilterArgs {
  query: string
  headings: HeadingSuggestion[]
  bookmarks: BookmarkSuggestion[]
}

export interface FilterResult {
  headings: HeadingSuggestion[]
  bookmarks: BookmarkSuggestion[]
}

// ── Picker UI state machine ───────────────────────────────────

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

// ── HyperlinkEditor public contract ───────────────────────────

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

// ── Hook contracts ────────────────────────────────────────────

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

// ── Component prop contracts ──────────────────────────────────

export interface SuggestionRowProps {
  id: string
  suggestion: Suggestion
  selected: boolean
  onPick: (s: Suggestion) => void
  onMouseEnter?: () => void
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
}

// ── Desktop popover store ─────────────────────────────────────

export type ActivePopoverKind = 'create' | 'edit'

export interface ActivePopover {
  kind: ActivePopoverKind
  host: HTMLElement
  props: Omit<HyperlinkEditorProps, 'variant'>
}

// ── Command args ──────────────────────────────────────────────

export interface ApplyHyperlinkArgs {
  href: string
  text?: string
}
