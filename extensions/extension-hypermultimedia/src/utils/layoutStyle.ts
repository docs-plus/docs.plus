import { isFloatedMedia, maxWidthForFloatedMedia } from './media-placement'

/** Layout attrs shared by node options, live DOM, and export HTML. */
export type StyleLayoutOptions = {
  width?: number | string | null
  height?: number | string | null
  float?: string | null
  clear?: string | null
  margin?: string | null
  display?: string | null
  justifyContent?: string | null
}

export type MediaLayoutStyleMode = 'live' | 'export-embed' | 'export-html' | 'export-image-block'

/** CamelCase bag — live DOM assigns directly; CSS export maps to kebab. */
type LayoutStyleBag = {
  display: string | null
  width: string | null
  height: string | null
  float: string | null
  clear: string | null
  margin: string | null
  justifyContent: string | null
  maxWidth: string | null
}

const CSS_PROP: { [K in keyof LayoutStyleBag]: string } = {
  display: 'display',
  width: 'width',
  height: 'height',
  float: 'float',
  clear: 'clear',
  margin: 'margin',
  justifyContent: 'justify-content',
  maxWidth: 'max-width'
}

const EMPTY_BAG: LayoutStyleBag = {
  display: null,
  width: null,
  height: null,
  float: null,
  clear: null,
  margin: null,
  justifyContent: null,
  maxWidth: null
}

const pixelOrNull = (value: number | string | null | undefined): string | null => {
  const parsed = parseInt(String(value), 10)
  return Number.isFinite(parsed) ? `${parsed}px` : null
}

function resolvePlacement(attrs: StyleLayoutOptions, defaults?: StyleLayoutOptions) {
  const float = attrs.float ?? defaults?.float ?? null
  const margin = attrs.margin ?? defaults?.margin ?? null
  const clear = attrs.clear ?? defaults?.clear ?? null
  const floated = isFloatedMedia(float)
  return {
    float,
    margin,
    clear,
    floated,
    maxWidth: floated ? maxWidthForFloatedMedia(margin) : null
  }
}

/** Attrs → layout bag. Float max-width and layout props live here only. */
export function mediaLayoutStyleProps(
  attrs: StyleLayoutOptions,
  mode: MediaLayoutStyleMode,
  defaults?: StyleLayoutOptions
): LayoutStyleBag {
  const placement = resolvePlacement(attrs, defaults)

  switch (mode) {
    case 'live':
      return {
        ...EMPTY_BAG,
        display: attrs.display ?? null,
        width: pixelOrNull(attrs.width),
        float: placement.float,
        clear: placement.clear,
        margin: placement.margin,
        justifyContent: attrs.justifyContent ?? null,
        maxWidth: placement.maxWidth
      }
    case 'export-embed':
      return {
        ...EMPTY_BAG,
        display: attrs.display ?? 'block',
        height: pixelOrNull(attrs.height),
        width: pixelOrNull(attrs.width),
        float: placement.float,
        clear: placement.clear,
        margin: placement.margin,
        justifyContent: attrs.justifyContent ?? null,
        maxWidth: placement.maxWidth
      }
    case 'export-html':
      return {
        ...EMPTY_BAG,
        height: pixelOrNull(attrs.height) ?? pixelOrNull(defaults?.height),
        width: pixelOrNull(attrs.width) ?? pixelOrNull(defaults?.width),
        float: placement.float || null,
        clear: placement.clear || null,
        margin: placement.margin || null,
        maxWidth: placement.maxWidth
      }
    case 'export-image-block': {
      // Image block HTML omits unset / default sentinels.
      return {
        ...EMPTY_BAG,
        float: placement.float && placement.float !== 'unset' ? placement.float : null,
        clear: placement.clear && placement.clear !== 'none' ? placement.clear : null,
        margin: placement.margin && placement.margin !== '0in' ? placement.margin : null,
        maxWidth: placement.floated ? placement.maxWidth : null
      }
    }
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function formatMediaLayoutCss(props: LayoutStyleBag): string {
  return (Object.keys(CSS_PROP) as Array<keyof LayoutStyleBag>)
    .filter((key) => props[key] != null)
    .map((key) => `${CSS_PROP[key]}:${props[key]};`)
    .join(' ')
}

export function mediaLayoutCss(
  attrs: StyleLayoutOptions,
  mode: MediaLayoutStyleMode,
  defaults?: StyleLayoutOptions
): string {
  return formatMediaLayoutCss(mediaLayoutStyleProps(attrs, mode, defaults))
}

/**
 * Live node-view wrapper: commit layout attrs.
 * Clear `max-width` when not floated — otherwise wrap→inline keeps the float cap.
 */
export function applyMediaLayoutToDom(
  dom: HTMLElement,
  attrs: StyleLayoutOptions,
  dims: { width: number },
  options?: { justifyContent?: string }
): void {
  const bag = mediaLayoutStyleProps(
    {
      ...attrs,
      width: dims.width,
      justifyContent: options?.justifyContent ?? attrs.justifyContent ?? 'start'
    },
    'live'
  )

  if (bag.display) dom.style.display = bag.display
  if (bag.width) dom.style.width = bag.width
  if (bag.float != null) dom.style.float = bag.float
  if (bag.clear) dom.style.clear = bag.clear
  if (bag.margin) dom.style.margin = bag.margin
  if (bag.justifyContent) dom.style.justifyContent = bag.justifyContent

  if (bag.maxWidth) dom.style.maxWidth = bag.maxWidth
  else dom.style.removeProperty('max-width')
}

/** Pick layout fields from ProseMirror attrs / HTMLAttribute bags. */
export function styleLayoutFromAttrs(attrs: Record<string, unknown>): StyleLayoutOptions {
  return {
    width: attrs.width as StyleLayoutOptions['width'],
    height: attrs.height as StyleLayoutOptions['height'],
    float: attrs.float as StyleLayoutOptions['float'],
    clear: attrs.clear as StyleLayoutOptions['clear'],
    margin: attrs.margin as StyleLayoutOptions['margin'],
    display: attrs.display as StyleLayoutOptions['display'],
    justifyContent: attrs.justifyContent as StyleLayoutOptions['justifyContent']
  }
}
