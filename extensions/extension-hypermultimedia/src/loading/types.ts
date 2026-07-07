/** Persisted doc unchanged — loading UI is node-view shell only. */
export type MediaLoadingKind = 'image' | 'video' | 'audio' | 'embed'

export interface MediaLoadingShellContext {
  kind: MediaLoadingKind
  width: number
  height: number
  /** Shown in the default shell, e.g. "YouTube", "X". */
  provider?: string
  message?: string
}

/** Include `.hm-loading-shell__message` if `markError` should update visible text. */
export type MediaLoadingShellFactory = (context: MediaLoadingShellContext) => HTMLElement

/** `true` = built-in shell; `false` = off; function = custom overlay root. */
export type MediaLoadingShellOption = boolean | MediaLoadingShellFactory

export interface MediaLoadingBindLoadOptions {
  element: HTMLElement
  /** Defaults to always false — waits for element load/error events. */
  isAlreadyReady?: () => boolean
}

export interface MediaLoadingShellWrapOptions {
  /** Auto-settle via media element load/error; omit for manual (e.g. X oEmbed). */
  bindLoad?: MediaLoadingBindLoadOptions
  /** When set, used instead of the generic responsive host sync on mount. */
  syncLoadingHost?: (el: HTMLElement, width: number, height: number) => void
}

export interface MediaLoadingController {
  markReady: () => void
  markError: (message?: string) => void
  destroy: () => void
}
