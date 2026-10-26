export const ICON_HTML_MAX_BYTES = 64 * 1024

const MAX_LINK_TAGS = 64
const TARGET_SIZE = 32
const APPLE_TOUCH_SIZE = 180
const HEAD_END = '</head>'

const LINK_TAG_RE = /<link\b[^>]*>/gi
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const SIZE_RE = /^(\d{1,4})x\d{1,4}$/i

/**
 * Reads at most `cap` bytes and stops at `</head>`. A cut head is still
 * scanned, unlike `readCappedBody`, which drops the whole body over its cap.
 */
export const readHtmlHead = async (
  response: Response,
  hop: AbortController,
  cap = ICON_HTML_MAX_BYTES
): Promise<string> => {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let text = ''
  let total = 0
  try {
    while (total < cap) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = value.subarray(0, cap - total)
      total += chunk.byteLength
      const searchFrom = Math.max(0, text.length - HEAD_END.length)
      text += decoder.decode(chunk, { stream: true })
      const end = text.slice(searchFrom).toLowerCase().indexOf(HEAD_END)
      if (end !== -1) return text.slice(0, searchFrom + end)
    }
    return text
  } finally {
    hop.abort()
    reader.releaseLock()
  }
}

interface Candidate {
  href: string
  score: number
}

const readAttributes = (tag: string): Map<string, string> => {
  const attrs = new Map<string, string>()
  // Skip the tag name, so `<link` is never read as an attribute.
  for (const m of tag.slice(5).matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase()
    if (!attrs.has(name)) attrs.set(name, m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

const toHttpUrl = (raw: string, base: string): URL | null => {
  try {
    const url = new URL(raw.replace(/&amp;/gi, '&'), base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

// Distance from 32 px of the nearest declared size. No `sizes` means the usual size for that rel.
const sizeDistance = (sizes: string | undefined, usual: number): number => {
  const widths = (sizes ?? '')
    .trim()
    .split(/\s+/)
    .map((s) => SIZE_RE.exec(s))
    .filter((m) => m !== null)
    .map((m) => Number(m[1]))
  return Math.min(...(widths.length ? widths : [usual]).map((w) => Math.abs(w - TARGET_SIZE)))
}

/** Lower is better: `rel=icon` before apple-touch, PNG or ICO first, then the size nearest 32 px. */
const scoreLink = (attrs: Map<string, string>, url: URL, isTouch: boolean): number => {
  const type = (attrs.get('type') ?? '').toLowerCase()
  const path = url.pathname.toLowerCase()
  const pngOrIco =
    type === 'image/png' ||
    type === 'image/x-icon' ||
    type === 'image/vnd.microsoft.icon' ||
    path.endsWith('.png') ||
    path.endsWith('.ico')
  const distance = sizeDistance(attrs.get('sizes'), isTouch ? APPLE_TOUCH_SIZE : TARGET_SIZE)
  return (isTouch ? 10_000 : 0) + (pngOrIco ? 0 : 1_000) + distance
}

/**
 * Picks one icon href from the page head, or null. SVG and `data:` are skipped:
 * the byte sniff refuses SVG, and only an http(s) URL can go through `safeFetch`.
 */
export const pickIconHref = (head: string, base: string): string | null => {
  let best: Candidate | null = null
  let seen = 0
  for (const [tag] of head.matchAll(LINK_TAG_RE)) {
    if (++seen > MAX_LINK_TAGS) break
    const attrs = readAttributes(tag)
    const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/)
    const isIcon = rel.includes('icon')
    const isTouch = rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')
    if (!isIcon && !isTouch) continue
    if ((attrs.get('type') ?? '').toLowerCase().includes('svg')) continue
    const href = attrs.get('href')?.trim()
    if (!href) continue
    const url = toHttpUrl(href, base)
    if (!url || url.pathname.toLowerCase().endsWith('.svg')) continue
    const score = scoreLink(attrs, url, !isIcon)
    if (!best || score < best.score) best = { href: url.toString(), score }
  }
  return best?.href ?? null
}
