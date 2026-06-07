export interface StyleAttributes {
  display?: string
  height?: number | string
  width?: number | string
  float?: string
  clear?: string
  margin?: string
  justifyContent?: string
}

export const clearChildNodes = (node: HTMLElement): void => {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export const createElement = (tag: string, className = '', innerHTML = ''): HTMLElement => {
  const elem = document.createElement(tag)
  if (className) elem.classList.add(className)
  if (innerHTML) elem.innerHTML = innerHTML
  return elem
}

export const applyStyles = (dom: HTMLElement, styles: StyleAttributes): void => {
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

/** Builds a layout style string from node options merged with HTML attributes. */
export const createStyleString = (
  options: StyleLayoutOptions,
  HTMLAttributes: StyleLayoutOptions
): string => {
  const styles: Record<string, string | null> = {
    height:
      options.height || HTMLAttributes.height
        ? `${options.height || parseInt(HTMLAttributes.height as string, 10)}px`
        : null,
    width:
      options.width || HTMLAttributes.width
        ? `${options.width || parseInt(HTMLAttributes.width as string, 10)}px`
        : null,
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
