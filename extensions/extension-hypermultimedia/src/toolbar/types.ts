import type { Editor } from '@tiptap/core'

export type MediaActionPlacement = 'inline' | 'menu'

/** Everything an action needs to read state and mutate the node. Built per open. */
export interface MediaActionContext {
  editor: Editor
  nodeType: string
  nodePos: number
  /** Node attrs snapshotted at toolbar-open. Attr-mutating picks tear the bar down (see createMediaToolbar), so a re-hover always rebuilds with fresh attrs — no live getter needed. */
  attrs: Record<string, unknown>
  /** The media wrapper element that hosts the toolbar (`.hypermultimedia--<type>__content`). */
  wrapper: HTMLElement
  /** Dismiss any open menu/submenu popover (not the in-place bar — the controls layer owns that). */
  close: () => void
}

export interface MediaAction {
  id: string
  label: (ctx: MediaActionContext) => string
  /** Inline SVG markup; return `null` to render a text button using `label`. */
  icon?: (ctx: MediaActionContext) => string | null
  placement: MediaActionPlacement
  /** Hidden entirely when this returns false. Default: shown. */
  isVisible?: (ctx: MediaActionContext) => boolean
  isActive?: (ctx: MediaActionContext) => boolean
  /** Direct click handler. Mutually exclusive with `renderSubmenu`. */
  run?: (ctx: MediaActionContext) => void
  /** Builds a submenu body (alignment options, X size/theme). Inline → popover; menu → expanded row. */
  renderSubmenu?: (ctx: MediaActionContext) => HTMLElement
  /** Ascending sort within a placement group. Default 100. */
  order?: number
}

export type MediaActionList = MediaAction[]

/** Host hook to add, remove, or reorder the resolved actions for a node. */
export type MediaActionsResolver = (
  defaults: MediaActionList,
  ctx: { nodeType: string }
) => MediaActionList

export interface MediaToolbarOptions {
  /** The media wrapper element (toolbar mounts inside it, top-right). */
  target: HTMLElement
  editor: Editor
  nodeType: string
  /** Resolved by the controls layer (`resolveMediaNodePos`) — do not re-derive. */
  nodePos: number
}

/** Return an element for the desktop overlay, or `null` so the host renders its own surface. */
export type MediaToolbarFactory = (options: MediaToolbarOptions) => HTMLElement | null
