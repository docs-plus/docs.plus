export const applyStyles = (dom: HTMLElement, styles: StyleLayoutOptions): void => {
  const style = dom.style as unknown as Record<string, string>
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined && value !== null) {
      style[key] = typeof value === 'number' ? `${value}px` : value
    }
  }
}

export const generateShortId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 7) // 5 random characters
  const timePart = Date.now().toString(36).slice(-5) // last 5 characters of the current time
  return `${randomPart}-${timePart}`
}

export interface StyleLayoutOptions {
  width?: number | string
  height?: number | string
  margin?: string
  clear?: string
  float?: string | null
  display?: string
  justifyContent?: string
}

/** Drops null/undefined entries and joins the rest into a `key:value;` style string. */
const formatStyleProperties = (styleProps: Record<string, string | number | null>): string =>
  Object.entries(styleProps)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}:${value};`)
    .join(' ')

/** Layout wrapper style for iframe embed nodes (export / static HTML). */
export const createEmbedWrapperStyle = (
  attrs: StyleLayoutOptions & { display?: string; justifyContent?: string }
): string => {
  const height = parseInt(String(attrs.height), 10)
  const width = parseInt(String(attrs.width), 10)

  return formatStyleProperties({
    display: attrs.display ?? 'block',
    height: Number.isNaN(height) ? null : `${height}px`,
    width: Number.isNaN(width) ? null : `${width}px`,
    float: attrs.float ?? null,
    clear: attrs.clear ?? null,
    margin: attrs.margin ?? null,
    'justify-content': attrs.justifyContent ?? null
  })
}

/** Finite-pixel value or null — guards parseInt(NaN/undefined) leaking "NaNpx". */
const pixelValue = (value: number | string | null | undefined): string | null => {
  const parsed = parseInt(String(value), 10)
  return Number.isFinite(parsed) ? `${parsed}px` : null
}

/**
 * Builds a layout style string from HTML attributes, falling back to node options.
 * Attrs come first: a committed per-node width/height must beat the kit default.
 */
export const createStyleString = (
  options: StyleLayoutOptions,
  HTMLAttributes: StyleLayoutOptions
): string => {
  const styles: Record<string, string | null> = {
    height: pixelValue(HTMLAttributes.height) ?? pixelValue(options.height),
    width: pixelValue(HTMLAttributes.width) ?? pixelValue(options.width),
    float: HTMLAttributes.float || null,
    clear: HTMLAttributes.clear || null,
    margin: HTMLAttributes.margin || null
  }

  return formatStyleProperties(styles)
}

/** Drops null/false entries before writing boolean HTML attributes onto media tags. */
export function omitNullishAndFalse(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== false) result[key] = value
  }
  return result
}
