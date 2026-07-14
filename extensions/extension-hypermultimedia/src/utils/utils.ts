import { mediaLayoutCss, type StyleLayoutOptions } from './layoutStyle'

export type { StyleLayoutOptions } from './layoutStyle'

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

/** Layout wrapper style for iframe embed nodes (export / static HTML). */
export const createEmbedWrapperStyle = (attrs: StyleLayoutOptions): string =>
  mediaLayoutCss(attrs, 'export-embed')

/**
 * Builds a layout style string from HTML attributes, falling back to node options.
 * Attrs come first: a committed per-node width/height must beat the kit default.
 */
export const createStyleString = (
  options: StyleLayoutOptions,
  HTMLAttributes: StyleLayoutOptions
): string => mediaLayoutCss(HTMLAttributes, 'export-html', options)

/** Drops null/false entries before writing boolean HTML attributes onto media tags. */
export function omitNullishAndFalse(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== false) result[key] = value
  }
  return result
}
