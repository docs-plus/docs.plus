export const httpUrl = (href: string): URL | null => {
  try {
    const u = new URL(href)
    return /^https?:$/.test(u.protocol) ? u : null
  } catch {
    return null
  }
}

const cssUrl = (u: string) => `url("${u.replace(/["\\\n\r\f]/g, encodeURIComponent)}")`

/** Per helper instance: true once a URL loaded, false once it failed, else the imgs waiting on its one request. */
export type IconUrls = Map<string, boolean | HTMLImageElement[]>

// Set src. A cached URL completes at once, so a rebuild shows it with no flash.
const load = (img: HTMLImageElement, url: string, urls: IconUrls, done?: (ok: boolean) => void) => {
  img.onload = () => {
    img.hidden = false
    done?.(true)
  }
  img.onerror = () => {
    urls.set(url, false)
    done?.(false)
  }
  img.src = url
  if (img.complete && img.naturalWidth > 0) img.hidden = false
}

/** The first img for a URL makes the request. Later imgs get src only after it loads:
 *  on a cold mount, src on every img cost about 10 to 80 us each in Chrome (#516).
 *  The mark view sets draggable, aria-hidden, contenteditable and the hyperlink-icon class. */
export function imgIcon(url: string, tile: boolean, urls: IconUrls): HTMLImageElement {
  const img = document.createElement('img') // no decoding='async': a cached rebuild may paint blank (UNVERIFIED)
  img.alt = ''
  img.width = 16 // fallback size when no CSS loads
  img.height = 16
  img.referrerPolicy = 'no-referrer' // no crossorigin: mixed CORS modes may split the image cache (UNVERIFIED)
  if (tile) img.className = 'hyperlink-icon-tile'
  img.hidden = true
  const state = urls.get(url)
  if (state === false) return img // known miss: no request, stays hidden
  if (Array.isArray(state)) {
    state.push(img)
    return img
  }
  if (state === true) {
    load(img, url, urls)
    return img
  }
  const waiting: HTMLImageElement[] = []
  urls.set(url, waiting)
  load(img, url, urls, (ok) => {
    if (!ok) return
    urls.set(url, true)
    for (const w of waiting) load(w, url, urls)
  })
  if (!img.hidden) urls.set(url, true) // cached: later links need not wait
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
