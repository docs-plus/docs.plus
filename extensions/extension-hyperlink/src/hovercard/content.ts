import { hasMod } from '../interactions/modKey'
import type { LinkIconResolver } from '../link-icons/types'
import { copyToClipboard } from '../utils/copyToClipboard'
import { createHTMLElement } from '../utils/createHTMLElement'
import { logger } from '../utils/logger'
import { normalizeHref } from '../utils/normalizeHref'
import { createIcon, hasIcon } from './icons'
import type { HovercardData, HovercardFact, ImageShape } from './types'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
// Covers the 200 ms fold; transitionend never fires under `transition: none`.
const FOLD_FALLBACK_MS = 200
const COPIED_MS = 1500
const NO_PREVIEW = 'No preview for this page.'

export type PreloadedImage = {
  img: HTMLImageElement
  settled: 'ready' | 'failed' | 'pending'
  /** Resolves once `settled` leaves `pending`. Never rejects. */
  done: Promise<void>
}

/** What the card shows above its link line. */
export type HovercardBody =
  | { state: 'loading' }
  | { state: 'empty' }
  | {
      state: 'data'
      data: HovercardData & { title: string }
      picture: PreloadedImage | null
      shape: ImageShape
    }

export type HovercardContent = {
  element: HTMLElement
  /** Replaces everything above the link line in place. The link line and its buttons stay. */
  setBody: (body: HovercardBody) => void
  dispose: () => void
}

type Deps = {
  siteIcon?: LinkIconResolver
  open: (href: string, newTab: boolean) => void
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

// A failed thumb or tile only fades in place (A5), so the text beside it never moves.
const createImageWell = (image: PreloadedImage, shape: ImageShape): HTMLElement | null => {
  if (image.settled === 'failed') return null
  const well = createHTMLElement('div', { className: 'hyperlink-hovercard__image' })
  well.dataset.state = image.settled === 'ready' ? 'ready' : 'loading'
  well.append(image.img)
  if (image.settled === 'pending') {
    void image.done.then(() => {
      if (image.settled === 'ready') well.dataset.state = 'ready'
      else if (shape === 'cover') collapseWell(well)
      else well.dataset.state = 'failed'
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
const createTitle = (text: string, href: string, open: Deps['open']): HTMLElement => {
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
    open(href, hasMod(e))
  })
  title.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return
    e.preventDefault()
    open(href, true)
  })
  return title
}

const createFacts = (facts: HovercardFact[]): HTMLElement => {
  const row = createHTMLElement('div', { className: 'hyperlink-hovercard__facts' })
  for (const { icon, text } of facts.slice(0, 3)) {
    const fact = createHTMLElement('span', { className: 'hyperlink-hovercard__fact' })
    if (hasIcon(icon)) fact.append(createIcon(icon))
    fact.append(createHTMLElement('span', { textContent: text }))
    row.append(fact)
  }
  return row
}

const createMain = (body: HovercardBody, href: string, deps: Deps): HTMLElement => {
  const main = createHTMLElement('div', { className: 'hyperlink-hovercard__main' })
  const text = createHTMLElement('div', { className: 'hyperlink-hovercard__body' })
  main.append(text)

  if (body.state === 'loading') {
    text.setAttribute('aria-busy', 'true')
    for (let i = 0; i < 3; i++) {
      text.append(createHTMLElement('span', { className: 'hyperlink-hovercard__bar' }))
    }
    return main
  }

  if (body.state !== 'data') {
    text.append(textBlock('hyperlink-hovercard__note', NO_PREVIEW))
    return main
  }

  const { data } = body
  text.append(createTitle(data.title, href, deps.open))
  if (data.facts?.length) text.append(createFacts(data.facts))
  if (data.description) text.append(textBlock('hyperlink-hovercard__description', data.description))

  const well = body.picture && createImageWell(body.picture, body.shape)
  if (!well) return main
  if (body.shape !== 'cover') main.classList.add(`hyperlink-hovercard__main--${body.shape}`)
  main.prepend(well)
  return main
}

const createAction = (label: string, ...icons: SVGSVGElement[]): HTMLButtonElement => {
  const button = createHTMLElement('button', {
    type: 'button',
    className: 'hyperlink-hovercard__action',
    tabIndex: -1
  })
  button.setAttribute('aria-label', label)
  button.append(...icons)
  // A press must not take focus, so the caret stays in the editor.
  button.addEventListener('mousedown', (e) => e.preventDefault())
  return button
}

/** Built from the host's `fetchMetadata` data, never from mark attrs. */
export const createHovercardContent = (
  href: string,
  body: HovercardBody,
  deps: Deps
): HovercardContent => {
  const card = createHTMLElement('div', { className: 'hyperlink-hovercard' })
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const site = createHTMLElement('div', { className: 'hyperlink-hovercard__site' })
  const icon = resolveSiteIcon(deps.siteIcon, href)
  if (icon) {
    icon.classList.add('hyperlink-hovercard__site-icon')
    icon.setAttribute('aria-hidden', 'true')
    site.append(icon)
  }
  const { host, rest } = urlParts(href)
  const url = createHTMLElement('span', { className: 'hyperlink-hovercard__url' })
  url.append(
    createHTMLElement('span', { className: 'hyperlink-hovercard__host', textContent: host })
  )
  if (rest)
    url.append(
      createHTMLElement('span', { className: 'hyperlink-hovercard__path', textContent: rest })
    )

  const check = createIcon('check')
  check.classList.add('hyperlink-hovercard__check')
  const copy = createAction('Copy link', createIcon('copy'), check)
  const resetCopy = (): void => {
    delete copy.dataset.copied
    copy.setAttribute('aria-label', 'Copy link')
  }
  copy.addEventListener('click', () => {
    // A refused write keeps the copy icon; the button has nothing else to say.
    void copyToClipboard(href).then((ok) => {
      if (!ok || disposed) return
      copy.dataset.copied = ''
      copy.setAttribute('aria-label', 'Link copied')
      clearTimeout(copiedTimer)
      copiedTimer = setTimeout(resetCopy, COPIED_MS)
    })
  })
  const open = createAction('Open in new tab', createIcon('open'))
  open.addEventListener('click', () => deps.open(href, true))
  site.append(url, copy, open)

  let main = createMain(body, href, deps)
  card.append(main, site)

  return {
    element: card,
    setBody: (next) => {
      const nextMain = createMain(next, href, deps)
      nextMain.dataset.swapped = ''
      main.replaceWith(nextMain)
      main = nextMain
    },
    dispose: () => {
      disposed = true
      clearTimeout(copiedTimer)
    }
  }
}
