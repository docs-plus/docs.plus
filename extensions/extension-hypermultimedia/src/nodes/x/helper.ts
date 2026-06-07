import { HTMLSanitizer } from '../../utils/sanitizeHtml'

/** Matches x.com / twitter.com status URLs, including share params like `?s=20`. */
export const X_URL_REGEX_GLOBAL =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/[0-9]+(?:\/|\?|#|$)[^\s]*/gi

/** Canonical `https://x.com/{user}/status/{id}` or null when not a status URL. */
export const normalizeXUrl = (raw: string): string | null => {
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

export const isValidXUrl = (url: string): boolean => normalizeXUrl(url) !== null

interface TwttrWidgets {
  load: (element: HTMLElement) => void
}

interface Twttr {
  widgets: TwttrWidgets
}

declare global {
  interface Window {
    twttr?: Twttr
  }
}

const X_SCRIPT_POLL_MS = 200
const X_SCRIPT_TIMEOUT_MS = 10_000
const X_LAYOUT_TIMEOUT_MS = 8_000
const X_LAYOUT_MIN_HEIGHT_PX = 50
const X_LAYOUT_STABLE_FRAMES = 2

function hasRenderableXEmbed(wrapper: HTMLElement): boolean {
  return wrapper.querySelector('blockquote.twitter-tweet, iframe') != null
}

/** Grows the loading host while widgets.js expands the tweet (before markReady). */
export function watchXEmbedHeight(
  wrapper: HTMLElement,
  onHeight: (height: number) => void
): () => void {
  const measure = () => {
    const h = Math.ceil(wrapper.scrollHeight)
    if (h > 0) onHeight(h)
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

export const loadXScript = (signal?: AbortSignal): Promise<Twttr> => {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  if (window.twttr) {
    return Promise.resolve(window.twttr)
  }

  return new Promise((resolve, reject) => {
    let pollId: ReturnType<typeof setInterval> | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (pollId != null) clearInterval(pollId)
      if (timeoutId != null) clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
    }

    const finish = (fn: () => void) => {
      cleanup()
      fn()
    }

    const onAbort = () => finish(() => reject(new DOMException('Aborted', 'AbortError')))

    timeoutId = setTimeout(() => {
      finish(() => reject(new Error('X widgets script timed out')))
    }, X_SCRIPT_TIMEOUT_MS)

    signal?.addEventListener('abort', onAbort, { once: true })

    const existingScript = document.querySelector(
      'script[src="https://platform.twitter.com/widgets.js"]'
    )

    if (existingScript) {
      pollId = setInterval(() => {
        if (window.twttr) finish(() => resolve(window.twttr))
      }, X_SCRIPT_POLL_MS)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => finish(() => resolve(window.twttr!))
    script.onerror = () => finish(() => reject(new Error('Failed to load X widgets script')))
    document.head.append(script)
  })
}

export const fetchOEmbedHtml = async (params: Record<string, string | number>): Promise<string> => {
  const urlParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  )
  const urlWithParams = `https://publish.twitter.com/oembed?${urlParams.toString()}`

  const response = await fetch(urlWithParams)

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

  try {
    const html = await fetchOEmbedHtml(params)
    if (signal?.aborted) return false
    wrapper.innerHTML = HTMLSanitizer.sanitize(html)
  } catch {
    // oEmbed may fail; widgets.js can still render from the status URL.
  }

  if (signal?.aborted) return false

  try {
    const twttr = await loadXScript(signal)
    if (signal?.aborted) return false
    void twttr.widgets.load(wrapper)
    await waitForXEmbedStable(wrapper, signal)
  } catch {
    return hasRenderableXEmbed(wrapper)
  }

  return hasRenderableXEmbed(wrapper)
}
