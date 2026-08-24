/** Persisted doc unchanged — loading UI is node-view shell only. */
export type MediaLoadingKind = 'image' | 'video' | 'audio' | 'embed'

export interface MediaLoadingShellContext {
  kind: MediaLoadingKind
  width: number
  height: number
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
  syncLoadingHost?: (el: HTMLElement, width: number, height: number) => void
}

export interface MediaLoadingController {
  markReady: () => void
  markError: (message?: string) => void
  destroy: () => void
}
