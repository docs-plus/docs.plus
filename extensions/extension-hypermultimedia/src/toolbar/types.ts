import type { Editor } from '@tiptap/core'

export type MediaActionPlacement = 'inline' | 'overflow'

export interface MediaActionContext {
  editor: Editor
  nodeType: string
  nodePos: number
  /** Snapshotted at open. Attr-mutating picks tear the bar down, so a re-hover rebuilds with fresh attrs. */
  attrs: Record<string, unknown>
  wrapper: HTMLElement
  /** Dismisses a menu/submenu popover, not the in-place bar — the controls layer owns that. */
  close: () => void
}

export interface MediaAction {
  id: string
  label: (ctx: MediaActionContext) => string
  /** One-off SVG override; omit on custom bricks and use `mediaToolbarIcons` by `id`. */
  icon?: (ctx: MediaActionContext) => string | null
  placement: MediaActionPlacement
  isVisible?: (ctx: MediaActionContext) => boolean
  isActive?: (ctx: MediaActionContext) => boolean
  /** Mutually exclusive with `renderSubmenu`. */
  run?: (ctx: MediaActionContext) => void
  /** Inline → popover; overflow → expanded row. */
  renderSubmenu?: (ctx: MediaActionContext) => HTMLElement
  dividerAfter?: boolean
}

export type MediaActionList = MediaAction[]

export type MediaActionsResolver = (
  defaults: MediaActionList,
  ctx: { nodeType: string }
) => MediaActionList

export interface MediaToolbarOptions {
  target: HTMLElement
  editor: Editor
  nodeType: string
  /** Snapshot at open. Custom factories must re-resolve at action time (e.g. `resolveMediaNodePos`). */
  nodePos: number
}

export type MediaToolbarFactory = (options: MediaToolbarOptions) => HTMLElement | null
