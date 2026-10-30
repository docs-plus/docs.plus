import { hasMod } from '../interactions/modCursor'
import type { LinkIconResolver } from '../link-icons/types'
import { createHTMLElement } from '../utils/createHTMLElement'
import { logger } from '../utils/logger'
import { normalizeHref } from '../utils/normalizeHref'
import type { HovercardData } from './types'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
// Covers the 200 ms fold; transitionend never fires under `transition: none`.
const FOLD_FALLBACK_MS = 200

export type PreloadedImage = {
  img: HTMLImageElement
  settled: 'ready' | 'failed' | 'pending'
  /** Resolves once `settled` leaves `pending`. Never rejects. */
  done: Promise<void>
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

// A failed thumb only fades in place (A5), so the text beside it never moves.
const createImageWell = (image: PreloadedImage, shape: 'cover' | 'thumb'): HTMLElement | null => {
  if (image.settled === 'failed') return null
  const well = createHTMLElement('div', { className: 'hyperlink-hovercard__image' })
  well.dataset.state = image.settled === 'ready' ? 'ready' : 'loading'
  well.append(image.img)
  if (image.settled === 'pending') {
    void image.done.then(() => {
      if (image.settled === 'ready') well.dataset.state = 'ready'
      else if (shape === 'thumb') well.dataset.state = 'failed'
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

const hostnameOf = (href: string): string => {
  try {
    return new URL(normalizeHref(href)).hostname || href
  } catch {
    return href
  }
}

/** Read-only: built from the host's `fetchMetadata` data, never from mark attrs. */
export const createHovercardContent = (
  data: HovercardData,
  href: string,
  picture: PreloadedImage | null,
  shape: 'cover' | 'thumb',
  deps: {
    siteIcon?: LinkIconResolver
    open: (href: string, newTab: boolean) => void
  }
): HTMLElement => {
  const card = createHTMLElement('div', { className: 'hyperlink-hovercard' })

  const well = picture && createImageWell(picture, shape)
  if (well) {
    if (shape === 'thumb') card.classList.add('hyperlink-hovercard--thumb')
    card.append(well)
  }

  const body = createHTMLElement('div', { className: 'hyperlink-hovercard__body' })
  const site = createHTMLElement('div', { className: 'hyperlink-hovercard__site' })
  const icon = resolveSiteIcon(deps.siteIcon, href)
  if (icon) {
    icon.classList.add('hyperlink-hovercard__site-icon')
    icon.setAttribute('aria-hidden', 'true')
    site.append(icon)
  }
  site.append(createHTMLElement('span', { textContent: hostnameOf(href) }))

  const title = createHTMLElement('a', {
    className: 'hyperlink-hovercard__title',
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: data.title || href
  })
  title.addEventListener('click', (e) => {
    e.preventDefault()
    deps.open(href, hasMod(e))
  })
  title.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return
    e.preventDefault()
    deps.open(href, true)
  })
  body.append(site, title)

  if (data.description) {
    body.append(
      createHTMLElement('p', {
        className: 'hyperlink-hovercard__description',
        textContent: data.description
      })
    )
  }

  card.append(body)
  return card
}
