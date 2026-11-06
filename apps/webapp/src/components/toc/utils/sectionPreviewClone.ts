import { MEDIA_INSERT_REGISTRY } from '@components/TipTap/mediaPopovers/mediaInsert'
import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import { useStore } from '@stores'

// Section preview clone: strips live widgets, keeps text and one still media cover.
const PREVIEW_MAX_BLOCKS = 5

const PREVIEW_STRIP_SEL = [
  '.ha-wrap',
  '.ha-group',
  '.ha-selection-comment-dock',
  '.collaboration-cursor__caret',
  '.collaboration-cursor__label',
  '.collaboration-cursor__avatar',
  '.ProseMirror-widget',
  '.hyperlink-icon',
  '.heading-fold-crinkle',
  '.media-toolbar',
  '.hypermultimedia__resize-gripper',
  '.ProseMirror-separator',
  '.ProseMirror-trailingBreak',
  '.hm-caption',
  '.hm-loading-shell',
  '.hm-loading-shell__overlay',
  '.mermaid-diagram__head',
  '.mermaid-diagram__error',
  '.pele-zoom'
].join(',')

const MEDIA_ROOT_SEL = '[class*="hypermultimedia--"]'
const MEDIA_KIND = /hypermultimedia--([a-z]+)__content/
// Live players: each one would reload from its host on every preview open.
const LIVE_MEDIA_SEL = 'iframe, video, audio, embed, object'

export type PreviewMedia =
  { kind: 'image'; el: HTMLElement } | { kind: 'tile'; type: MediaNodeType | null }

export type SectionPreview = {
  heading: HTMLElement | null
  body: HTMLElement | null
  media: PreviewMedia | null
}

let inertDoc: Document | null = null

/** A copy in a document with no browsing context, so no iframe or media starts to load. */
function inertCopy(source: HTMLElement): HTMLElement {
  inertDoc ??= document.implementation.createHTMLDocument('')
  return inertDoc.importNode(source, true)
}

function headingLevel(el: Element): number | null {
  const tag = el.tagName
  if (tag.length === 2 && tag[0] === 'H' && tag[1] >= '1' && tag[1] <= '6') {
    return Number(tag[1])
  }
  return null
}

function collectSectionElements(headingId: string): HTMLElement[] {
  const editor = useStore.getState().settings.editor.instance
  if (!editor || editor.isDestroyed) return []

  const heading = editor.view.dom.querySelector(`[data-toc-id="${CSS.escape(headingId)}"]`)
  if (!(heading instanceof HTMLElement)) return []

  const level = headingLevel(heading)
  const out: HTMLElement[] = [heading]
  let el = heading.nextElementSibling
  while (el instanceof HTMLElement && out.length < PREVIEW_MAX_BLOCKS) {
    if (el.classList.contains('heading-fold-crinkle') || el.matches(PREVIEW_STRIP_SEL)) {
      el = el.nextElementSibling
      continue
    }
    const nextLevel = headingLevel(el)
    if (nextLevel != null && level != null && nextLevel <= level) break
    out.push(el)
    el = el.nextElementSibling
  }
  return out
}

function safePoster(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, window.location.href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** A video keeps the poster it already holds; every other live player goes. */
function replaceLiveMedia(root: HTMLElement) {
  root.querySelectorAll(LIVE_MEDIA_SEL).forEach((node) => {
    const poster = node.tagName === 'VIDEO' ? safePoster(node.getAttribute('poster')) : null
    if (!poster) {
      node.remove()
      return
    }
    const img = node.ownerDocument.createElement('img')
    img.alt = ''
    img.src = poster
    node.replaceWith(img)
  })
}

function isMediaRoot(el: HTMLElement): boolean {
  return el.matches(MEDIA_ROOT_SEL) || el.matches('img')
}

function takeFirstMedia(root: HTMLElement): HTMLElement | null {
  if (isMediaRoot(root)) return root
  const media =
    root.querySelector<HTMLElement>(MEDIA_ROOT_SEL) ?? root.querySelector<HTMLElement>('img')
  media?.remove()
  return media ?? null
}

function stripLeftoverMedia(root: HTMLElement) {
  root.querySelectorAll(`${MEDIA_ROOT_SEL}, img`).forEach((node) => node.remove())
}

function isPreviewNoise(el: HTMLElement): boolean {
  return !(el.textContent || '').replace(/\u00a0/g, ' ').trim()
}

function prunePreviewEmpties(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('p, div').forEach((el) => {
    if (el.querySelector('img') || el.matches(MEDIA_ROOT_SEL)) return
    if (isPreviewNoise(el)) el.remove()
  })
}

function fitPreviewMediaCover(node: HTMLElement) {
  const apply = (el: HTMLElement) => {
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.maxWidth = '100%'
    el.style.maxHeight = '100%'
    el.style.overflow = 'hidden'
    el.style.removeProperty('aspect-ratio')
  }
  apply(node)
  node.querySelectorAll<HTMLElement>('[class*="hypermultimedia"], .hm-media-host').forEach(apply)
  node.querySelectorAll<HTMLElement>('img').forEach((el) => {
    el.removeAttribute('width')
    el.removeAttribute('height')
    apply(el)
    el.style.objectFit = 'cover'
  })
}

const isMediaNodeType = (kind: string): kind is MediaNodeType =>
  Object.hasOwn(MEDIA_INSERT_REGISTRY, kind)

function mediaKind(root: HTMLElement): MediaNodeType | null {
  for (const el of [root, ...root.querySelectorAll(MEDIA_ROOT_SEL)]) {
    const kind = MEDIA_KIND.exec(el.getAttribute('class') ?? '')?.[1]
    if (kind && isMediaNodeType(kind)) return kind
  }
  return null
}

function toPreviewMedia(root: HTMLElement): PreviewMedia {
  if (root.matches('img') || root.querySelector('img')) {
    fitPreviewMediaCover(root)
    return { kind: 'image', el: root }
  }
  return { kind: 'tile', type: mediaKind(root) }
}

function preparePreviewClone(source: HTMLElement): HTMLElement {
  const clone = inertCopy(source)
  replaceLiveMedia(clone)
  clone.removeAttribute('id')
  clone.removeAttribute('data-toc-id')
  clone.removeAttribute('contenteditable')
  clone.classList.remove('heading-fold-hidden')
  clone.style.paddingRight = '0'
  clone.querySelectorAll(PREVIEW_STRIP_SEL).forEach((node) => node.remove())
  clone.querySelectorAll('[contenteditable]').forEach((node) => {
    node.removeAttribute('contenteditable')
  })
  // Duplicate ids would clash with the live page. A diagram's url(#id) refs still resolve to it.
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
  return clone
}

/** Heading, excerpt and first media of one section, cloned from the live editor. */
export function buildSectionPreview(headingId: string): SectionPreview {
  let heading: HTMLElement | null = null
  let media: PreviewMedia | null = null
  const body = document.createElement('div')

  for (const source of collectSectionElements(headingId)) {
    const clone = preparePreviewClone(source)
    const taken = takeFirstMedia(clone)
    if (taken && !media) media = toPreviewMedia(taken)
    if (taken === clone) continue
    stripLeftoverMedia(clone)
    prunePreviewEmpties(clone)
    if (isPreviewNoise(clone)) continue
    if (!heading && headingLevel(clone) != null) {
      heading = clone
      continue
    }
    body.appendChild(clone)
  }

  return { heading, body: isPreviewNoise(body) ? null : body, media }
}
