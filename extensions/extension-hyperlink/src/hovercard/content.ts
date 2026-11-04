import { hasMod } from '../interactions/modKey'
import type { LinkIconResolver } from '../link-icons/types'
import { createHTMLElement } from '../utils/createHTMLElement'
import { Check, Copy, Title } from '../utils/icons'
import { logger } from '../utils/logger'
import { normalizeHref } from '../utils/normalizeHref'
import type { HovercardRenderContext, HovercardView } from './types'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
// Covers the 200 ms fold; transitionend never fires under `transition: none`.
const FOLD_FALLBACK_MS = 200
const COPIED_MS = 1500
const ICON_SIZE = 18
const NO_PREVIEW = 'No preview for this page.'

export type PreloadedImage = {
  img: HTMLImageElement
  settled: 'ready' | 'failed' | 'pending'
  /** Resolves once `settled` leaves `pending`. Never rejects. */
  done: Promise<void>
}

/** The built-in card. `setBody` replaces everything above the link line, so the link line stays. */
export type BuiltInCard = HovercardView & {
  setBody: (ctx: HovercardRenderContext, picture: PreloadedImage | null) => void
}

/** Starts the load now. The plugin decides how long to wait for it. */
export const preloadImage = (src: string): PreloadedImage => {
  // referrerPolicy before src, so the first request already sends no Referer.
  const img = createHTMLElement('img', {
    referrerPolicy: 'no-referrer',
    src,
    alt: '',
    decoding: 'async'
  })
  const image: PreloadedImage = { img, settled: 'pending', done: Promise.resolve() }
  image.done = img.decode().then(
    () => void (image.settled = 'ready'),
    () => void (image.settled = 'failed')
  )
  return image
}

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches

// The well folds away instead of vanishing, so the text under it slides up, not jumps.
const collapseWell = (well: HTMLElement): void => {
  if (prefersReducedMotion() || !well.isConnected) {
    well.remove()
    return
  }
  well.style.height = `${well.offsetHeight}px`
  void well.offsetHeight
  well.dataset.state = 'failed'
  well.style.height = '0px'
  const done = (): void => well.remove()
  well.addEventListener('transitionend', (e) => e.target === well && done())
  setTimeout(done, FOLD_FALLBACK_MS)
}

const createImageWell = (image: PreloadedImage): HTMLElement | null => {
  if (image.settled === 'failed') return null
  const well = createHTMLElement('div', { className: 'hyperlink-hovercard__image' })
  well.dataset.state = image.settled === 'ready' ? 'ready' : 'loading'
  well.append(image.img)
  if (image.settled === 'pending') {
    void image.done.then(() => {
      if (image.settled === 'ready') well.dataset.state = 'ready'
      else collapseWell(well)
    })
  }
  return well
}

const warnedResolvers = new WeakSet<object>()

// Same contract as `linkIcon`: a fresh element with no text, else no icon.
const resolveSiteIcon = (
  siteIcon: LinkIconResolver | undefined,
  href: string
): HTMLElement | null => {
  if (!siteIcon) return null
  let el: unknown
  try {
    el = siteIcon({ href })
  } catch (e) {
    if (!warnedResolvers.has(siteIcon)) logger.error('siteIcon threw; the card shows no icon', e)
    warnedResolvers.add(siteIcon)
    return null
  }
  if (el instanceof HTMLElement && !el.parentNode && !el.textContent) return el
  if (el != null && !warnedResolvers.has(siteIcon)) {
    warnedResolvers.add(siteIcon)
    logger.error('siteIcon must return a fresh element with no text')
  }
  return null
}

const urlParts = (href: string): { host: string; rest: string } => {
  try {
    const url = new URL(normalizeHref(href))
    if (!url.hostname) return { host: href, rest: '' }
    const rest = url.pathname + url.search
    return { host: url.hostname, rest: rest === '/' ? '' : rest }
  } catch {
    return { host: href, rest: '' }
  }
}

const textBlock = (className: string, textContent: string): HTMLElement =>
  createHTMLElement('p', { className, textContent })

// Tab must stay in the editor (it indents there), so no card control joins the Tab order.
const createTitle = (text: string, { href, open }: HovercardRenderContext): HTMLElement => {
  const title = createHTMLElement('a', {
    className: 'hyperlink-hovercard__title',
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    tabIndex: -1,
    textContent: text
  })
  title.addEventListener('click', (e) => {
    e.preventDefault()
    open(hasMod(e))
  })
  title.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return
    e.preventDefault()
    open(true)
  })
  return title
}

const createMain = (ctx: HovercardRenderContext, picture: PreloadedImage | null): HTMLElement => {
  const main = createHTMLElement('div', { className: 'hyperlink-hovercard__main' })
  const text = createHTMLElement('div', { className: 'hyperlink-hovercard__body' })
  main.append(text)

  if (ctx.state === 'loading') {
    text.setAttribute('aria-busy', 'true')
    for (let i = 0; i < 3; i++) {
      text.append(createHTMLElement('span', { className: 'hyperlink-hovercard__bar' }))
    }
    return main
  }

  const data = ctx.state === 'data' ? ctx.data : null
  if (!data?.title) {
    text.append(textBlock('hyperlink-hovercard__note', NO_PREVIEW))
    return main
  }

  text.append(createTitle(data.title, ctx))
  if (data.description) text.append(textBlock('hyperlink-hovercard__description', data.description))
  const well = picture && createImageWell(picture)
  if (well) main.prepend(well)
  return main
}

const createCopyButton = (copy: HovercardRenderContext['copy']): HTMLButtonElement => {
  // Static icon strings only: no host data ever reaches `innerHTML`.
  const button = createHTMLElement('button', {
    type: 'button',
    className: 'hyperlink-hovercard__action',
    tabIndex: -1,
    innerHTML: Copy({ size: ICON_SIZE }) + Check({ size: ICON_SIZE })
  })
  button.lastElementChild?.classList.add('hyperlink-hovercard__check')
  button.setAttribute('aria-label', 'Copy link')
  // A press must not take focus, so the caret stays in the editor.
  button.addEventListener('mousedown', (e) => e.preventDefault())

  let timer: ReturnType<typeof setTimeout> | undefined
  const reset = (): void => {
    delete button.dataset.copied
    button.setAttribute('aria-label', 'Copy link')
  }
  button.addEventListener('click', () => {
    // A refused write keeps the copy icon; the button has nothing else to say.
    void copy().then((ok) => {
      if (!ok) return
      button.dataset.copied = ''
      button.setAttribute('aria-label', 'Link copied')
      clearTimeout(timer)
      timer = setTimeout(reset, COPIED_MS)
    })
  })
  return button
}

// Present only when the engine set `applyTitle`: the link text is its own URL.
const createTitleButton = (applyTitle: () => boolean): HTMLButtonElement => {
  const button = createHTMLElement('button', {
    type: 'button',
    className: 'hyperlink-hovercard__action',
    tabIndex: -1,
    innerHTML: Title({ size: ICON_SIZE })
  })
  button.setAttribute('aria-label', 'Use page title')
  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', () => applyTitle())
  return button
}

const createLinkLine = (
  { href, copy, applyTitle }: HovercardRenderContext,
  siteIcon: LinkIconResolver | undefined
): HTMLElement => {
  const line = createHTMLElement('div', { className: 'hyperlink-hovercard__site' })
  const icon = resolveSiteIcon(siteIcon, href)
  if (icon) {
    icon.classList.add('hyperlink-hovercard__site-icon')
    icon.setAttribute('aria-hidden', 'true')
    line.append(icon)
  }
  const { host, rest } = urlParts(href)
  const url = createHTMLElement('span', { className: 'hyperlink-hovercard__url' })
  url.append(
    createHTMLElement('span', { className: 'hyperlink-hovercard__host', textContent: host })
  )
  if (rest) {
    url.append(
      createHTMLElement('span', { className: 'hyperlink-hovercard__path', textContent: rest })
    )
  }
  line.append(url)
  if (applyTitle) line.append(createTitleButton(applyTitle))
  line.append(createCopyButton(copy))
  return line
}

/** Drawn from the public render context, like a host card. Never from mark attrs. */
export const createBuiltInCard = (
  ctx: HovercardRenderContext,
  picture: PreloadedImage | null,
  siteIcon: LinkIconResolver | undefined
): BuiltInCard => {
  const element = createHTMLElement('div')
  let main = createMain(ctx, picture)
  element.append(main, createLinkLine(ctx, siteIcon))

  return {
    element,
    setBody: (next, nextPicture) => {
      const nextMain = createMain(next, nextPicture)
      nextMain.dataset.swapped = ''
      main.replaceWith(nextMain)
      main = nextMain
    }
  }
}
