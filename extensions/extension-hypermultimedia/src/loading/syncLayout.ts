import { EMBED_LAYOUT_ATTR_KEYS } from '../utils/embedKit'
import { applyStyles } from '../utils/utils'

export { EMBED_LAYOUT_ATTR_KEYS }

const DEFAULT_LAYOUT_FALLBACK = { width: 640, height: 480 } as const
export const IMAGE_LAYOUT_FALLBACK = { width: 320, height: 240 } as const
export const AUDIO_LAYOUT_FALLBACK = { width: 450, height: 120 } as const

/** Loading shell: fill the wrapper up to committed attrs; shrink with the column. */
export function syncResponsiveMediaHost(el: HTMLElement, width: number, height: number): void {
  el.style.width = '100%'
  el.style.maxWidth = `${width}px`
  el.style.height = 'auto'
  if (width > 0 && height > 0) {
    el.style.aspectRatio = `${width} / ${height}`
  } else {
    el.style.removeProperty('aspect-ratio')
  }
}

/** Media surface inside `.hm-media-slot` — host carries aspect-ratio. */
export function syncMediaSurfaceFill(el: HTMLElement, width: number, height: number): void {
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.removeProperty('max-width')
  el.style.removeProperty('aspect-ratio')
  if (el instanceof HTMLIFrameElement) {
    el.setAttribute('width', String(width))
    el.setAttribute('height', String(height))
  }
}

export function parseLayoutDimensions(
  attrs: Record<string, unknown>,
  fallback: { width: number; height: number } = DEFAULT_LAYOUT_FALLBACK
): { width: number; height: number } {
  const width = parseInt(String(attrs.width), 10)
  const height = parseInt(String(attrs.height), 10)
  return {
    width: Number.isFinite(width) ? width : fallback.width,
    height: Number.isFinite(height) ? height : fallback.height
  }
}

export function layoutAttrsChanged(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  keys: readonly string[] = EMBED_LAYOUT_ATTR_KEYS
): boolean {
  return keys.some((key) => left[key] !== right[key])
}

function applyMediaWrapperLayout(
  dom: HTMLElement,
  attrs: Record<string, unknown>,
  dims: { width: number; height: number },
  options?: { justifyContent?: string }
): void {
  // No fixed `height` on the wrapper: the loading shell + media surface carry the pixel
  // height (syncResizableMediaLayout), so the wrapper grows to fit the caption below the
  // media instead of clipping it into the following paragraph.
  applyStyles(dom, {
    display: attrs.display as string,
    width: dims.width,
    float: attrs.float as string,
    clear: attrs.clear as string,
    margin: attrs.margin as string,
    justifyContent: (options?.justifyContent ?? attrs.justifyContent ?? 'start') as string
  })
}

export interface SyncResizableMediaLayoutOptions {
  width: number
  height: number
  loadingHost: HTMLElement
  surfaces: HTMLElement[]
  syncSurface?: (el: HTMLElement, width: number, height: number) => void
}

/** Mirror committed layout attrs onto the loading shell and rendered media surfaces. */
export function syncResizableMediaLayout(options: SyncResizableMediaLayoutOptions): void {
  const { width, height, loadingHost, surfaces, syncSurface = syncMediaSurfaceFill } = options
  syncResponsiveMediaHost(loadingHost, width, height)
  for (const surface of surfaces) {
    syncSurface(surface, width, height)
  }
}

export interface SyncMediaNodeLayoutOptions {
  wrapper: HTMLElement
  attrs: Record<string, unknown>
  loadingHost: HTMLElement
  surface: HTMLElement
  dims?: { width: number; height: number }
  fallback?: { width: number; height: number }
  justifyContent?: string
  syncSurface?: (el: HTMLElement, width: number, height: number) => void
}

/** Mirror committed attrs onto wrapper, loading shell, and the rendered media surface. */
export function syncMediaNodeLayout(options: SyncMediaNodeLayoutOptions): void {
  const dims =
    options.dims ??
    parseLayoutDimensions(options.attrs, options.fallback ?? DEFAULT_LAYOUT_FALLBACK)
  applyMediaWrapperLayout(
    options.wrapper,
    options.attrs,
    dims,
    options.justifyContent ? { justifyContent: options.justifyContent } : undefined
  )
  syncResizableMediaLayout({
    width: dims.width,
    height: dims.height,
    loadingHost: options.loadingHost,
    surfaces: [options.surface],
    syncSurface: options.syncSurface
  })
}

export function syncImageNodeLayout(options: {
  wrapper: HTMLElement
  attrs: Record<string, unknown>
  loadingHost: HTMLElement
  img: HTMLImageElement
  dims?: { width: number; height: number }
}): void {
  syncMediaNodeLayout({
    wrapper: options.wrapper,
    attrs: options.attrs,
    loadingHost: options.loadingHost,
    surface: options.img,
    dims: options.dims,
    fallback: IMAGE_LAYOUT_FALLBACK,
    justifyContent: 'start'
  })
}

export function syncIframeNodeLayout(options: {
  wrapper: HTMLElement
  attrs: Record<string, unknown>
  loadingHost: HTMLElement
  iframe: HTMLIFrameElement
  dims?: { width: number; height: number }
}): void {
  syncMediaNodeLayout({
    wrapper: options.wrapper,
    attrs: options.attrs,
    loadingHost: options.loadingHost,
    surface: options.iframe,
    dims: options.dims
  })
}
