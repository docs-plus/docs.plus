export const httpUrl = (href: string): URL | null => {
  try {
    const u = new URL(href)
    return /^https?:$/.test(u.protocol) ? u : null
  } catch {
    return null
  }
}

const cssUrl = (u: string) => `url("${u.replace(/["\\\n\r\f]/g, encodeURIComponent)}")`

/** `failed` is per helper instance; a URL that errored once is not requested again.
 *  The mark view sets draggable, aria-hidden, contenteditable and the hyperlink-icon class. */
export function imgIcon(url: string, tile: boolean, failed: Set<string>): HTMLImageElement {
  const img = document.createElement('img') // no decoding='async': a cached rebuild may paint blank (UNVERIFIED)
  img.alt = ''
  img.width = 16 // fallback size when no CSS loads
  img.height = 16
  img.referrerPolicy = 'no-referrer' // no crossorigin: mixed CORS modes may split the image cache (UNVERIFIED)
  if (tile) img.className = 'hyperlink-icon-tile'
  img.hidden = true
  if (failed.has(url)) return img // known miss: no request, stays hidden
  img.onload = () => {
    img.hidden = false
  }
  img.onerror = () => {
    failed.add(url)
  }
  img.src = url
  if (img.complete && img.naturalWidth > 0) img.hidden = false // cached: no flash on rebuild
  return img
}

export function pairIcon(light: string, dark: string): HTMLElement {
  const el = document.createElement('span') // size comes from .hyperlink-icon
  const s = el.style
  s.backgroundRepeat = 'no-repeat'
  s.backgroundPosition = 'center'
  s.backgroundSize = 'contain'
  s.backgroundImage = cssUrl(light) // old engines keep this
  s.backgroundImage = `light-dark(${cssUrl(light)}, ${cssUrl(dark)})` // ignored if unsupported
  return el
}
