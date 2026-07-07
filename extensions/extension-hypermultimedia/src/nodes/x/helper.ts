import { HTMLSanitizer } from '../../utils/sanitizeHtml'

/** Matches x.com / twitter.com status URLs, including share params like `?s=20`;
 * the (?=\s|$) boundary lets bare mid-sentence URLs match without eating trailing text. */
export const X_URL_REGEX_GLOBAL =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/[0-9]+(?:[/?#][^\s]*)?(?=\s|$)/gi

const X_OEMBED_HREF_HOSTS = ['x.com', 'twitter.com'] as const

/** Canonical `https://x.com/{user}/status/{id}` or null when not a status URL. */
export function normalizeXUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProtocol)
    const host = parsed.hostname.replace(/^www\./i, '').replace(/^mobile\./i, '')
    if (host !== 'x.com' && host !== 'twitter.com') return null

    const match = parsed.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]+)\/?$/i)
    if (!match) return null

    return `https://x.com/${match[1]}/status/${match[2]}`
  } catch {
    return null
  }
}

export function isValidXUrl(url: string): boolean {
  return normalizeXUrl(url) !== null
}

interface TwttrWidgets {
  load: (element: HTMLElement) => void
}

interface Twttr {
  ready: (callback: () => void) => void
  widgets: TwttrWidgets
}

// No `declare global` Window augmentation: the shipped .d.ts must not mutate
// consumers' Window type or collide with their own `twttr` declarations.
const getTwttr = (): Twttr | undefined => (window as Window & { twttr?: Twttr }).twttr

const X_SCRIPT_POLL_MS = 200
const X_SCRIPT_TIMEOUT_MS = 10_000
const X_LAYOUT_TIMEOUT_MS = 8_000
const X_LAYOUT_MIN_HEIGHT_PX = 50
const X_LAYOUT_STABLE_FRAMES = 2

function hasRenderableXEmbed(wrapper: HTMLElement): boolean {
  const blockquote = wrapper.querySelector('blockquote.twitter-tweet')
  if (blockquote) {
    const href = blockquote.querySelector('a')?.getAttribute('href') ?? ''
    if (normalizeXUrl(href)) return true
  }
  return wrapper.querySelector('iframe') != null
}

function measureEmbedHeight(element: HTMLElement): number {
  return Math.max(
    Math.ceil(element.scrollHeight),
    Math.ceil(element.getBoundingClientRect().height)
  )
}

export interface XEmbedHeightSyncOptions {
  /** Reserved shell height before the widget reports a real size. */
  minHeight: number
  /** When true, host uses fluid/auto height and only min-height tracks growth. */
  isFluid?: () => boolean
}

/** Tracks widget layout until dispose — pending fixed height, then fluid min-height. */
export function watchXEmbedHeight(
  wrapper: HTMLElement,
  host: HTMLElement,
  options: XEmbedHeightSyncOptions
): () => void {
  const apply = (height: number) => {
    const floor = Math.max(options.minHeight, height)
    if (options.isFluid?.()) {
      host.style.minHeight = `${floor}px`
      return
    }
    host.style.height = `${floor}px`
  }

  const measure = () => {
    const h = measureEmbedHeight(wrapper)
    if (h > 0) apply(h)
  }

  const ro = new ResizeObserver(measure)
  ro.observe(wrapper)
  const mo = new MutationObserver(measure)
  mo.observe(wrapper, { childList: true, subtree: true, attributes: true })
  measure()

  return () => {
    ro.disconnect()
    mo.disconnect()
  }
}

function delayMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const id = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(id)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function resolveXEmbedMeasureTarget(
  wrapper: HTMLElement,
  signal?: AbortSignal
): Promise<HTMLElement> {
  const deadline = Date.now() + 6_000
  while (Date.now() < deadline) {
    if (signal?.aborted) return wrapper
    const iframe = wrapper.querySelector('iframe')
    if (iframe instanceof HTMLIFrameElement) return iframe
    await delayMs(100, signal)
  }
  return wrapper
}

async function waitForStableSize(element: HTMLElement, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return

  await new Promise<void>((resolve) => {
    let lastHeight = 0
    let stableFrames = 0
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      ro.disconnect()
      window.clearTimeout(timeoutId)
      signal?.removeEventListener('abort', finish)
      resolve()
    }

    const timeoutId = window.setTimeout(finish, X_LAYOUT_TIMEOUT_MS)

    const ro = new ResizeObserver(() => {
      const h = Math.ceil(element.getBoundingClientRect().height)
      if (h < X_LAYOUT_MIN_HEIGHT_PX) return
      if (h === lastHeight) {
        stableFrames++
        if (stableFrames >= X_LAYOUT_STABLE_FRAMES) finish()
      } else {
        lastHeight = h
        stableFrames = 0
      }
    })

    ro.observe(element)
    signal?.addEventListener('abort', finish, { once: true })
  })
}

async function waitForXEmbedStable(wrapper: HTMLElement, signal?: AbortSignal): Promise<void> {
  const target = await resolveXEmbedMeasureTarget(wrapper, signal)
  await waitForStableSize(target, signal)
}

function whenTwttrReady(signal?: AbortSignal): Promise<Twttr> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  const existing = getTwttr()
  if (existing?.widgets) {
    return Promise.resolve(existing)
  }

  return new Promise((resolve, reject) => {
    let pollId: ReturnType<typeof setInterval> | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let settled = false

    const cleanup = () => {
      if (pollId != null) clearInterval(pollId)
      if (timeoutId != null) clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
    }

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    const onAbort = () => finish(() => reject(new DOMException('Aborted', 'AbortError')))

    timeoutId = setTimeout(() => {
      finish(() => reject(new Error('X widgets script timed out')))
    }, X_SCRIPT_TIMEOUT_MS)

    signal?.addEventListener('abort', onAbort, { once: true })

    const resolveIfReady = () => {
      const twttr = getTwttr()
      if (twttr?.widgets) {
        finish(() => resolve(twttr))
        return true
      }
      return false
    }

    if (resolveIfReady()) return

    getTwttr()?.ready?.(() => {
      if (signal?.aborted) {
        finish(() => reject(new DOMException('Aborted', 'AbortError')))
        return
      }
      if (!resolveIfReady()) {
        finish(() => reject(new Error('X widgets script loaded without twttr.widgets')))
      }
    })

    pollId = setInterval(() => {
      resolveIfReady()
    }, X_SCRIPT_POLL_MS)
  })
}

export function loadXScript(signal?: AbortSignal): Promise<Twttr> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  const existingScript = document.querySelector(
    'script[src="https://platform.twitter.com/widgets.js"]'
  )

  if (existingScript || getTwttr()) {
    return whenTwttrReady(signal)
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      whenTwttrReady(signal).then(resolve).catch(reject)
    }
    script.onerror = () => reject(new Error('Failed to load X widgets script'))
    document.head.append(script)
  })
}

export function sanitizeXEmbedHtml(html: string): string {
  return HTMLSanitizer.sanitize(html, { hrefHosts: X_OEMBED_HREF_HOSTS })
}

/** Minimal blockquote widgets.js needs when oEmbed is empty or scrubbed away. */
export function seedXEmbedMarkup(wrapper: HTMLElement, statusUrl: string): void {
  if (hasRenderableXEmbed(wrapper)) return

  const url = normalizeXUrl(statusUrl)
  if (!url) return

  wrapper.replaceChildren()
  const blockquote = document.createElement('blockquote')
  blockquote.className = 'twitter-tweet'
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.textContent = url
  blockquote.append(anchor)
  wrapper.append(blockquote)
}

export async function fetchOEmbedHtml(
  params: Record<string, string | number>,
  signal?: AbortSignal
): Promise<string> {
  const urlParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  )
  const urlWithParams = `https://publish.x.com/oembed?${urlParams.toString()}`

  const response = await fetch(urlWithParams, { signal })

  if (!response.ok) {
    throw new Error('Failed to fetch oEmbed HTML')
  }

  const data = (await response.json()) as { html?: string }
  return data.html ?? ''
}

/** Returns true when the wrapper has embed markup after oEmbed and/or widgets.js. */
export async function mountXEmbed(
  wrapper: HTMLDivElement,
  params: Record<string, string | number>,
  signal?: AbortSignal
): Promise<boolean> {
  if (signal?.aborted) return false

  const statusUrl = String(params.url ?? '')

  try {
    const html = await fetchOEmbedHtml(params, signal)
    if (signal?.aborted) return false
    wrapper.innerHTML = sanitizeXEmbedHtml(html)
  } catch {
    // oEmbed may fail; fall back to a blockquote seed for widgets.js.
  }

  seedXEmbedMarkup(wrapper, statusUrl)

  if (signal?.aborted) return false

  try {
    const twttr = await loadXScript(signal)
    if (signal?.aborted) return false
    twttr.widgets.load(wrapper)
    await waitForXEmbedStable(wrapper, signal)
  } catch {
    if (signal?.aborted) return false
    return hasRenderableXEmbed(wrapper)
  }

  if (signal?.aborted) return false
  return hasRenderableXEmbed(wrapper)
}
