import { useStore } from '@stores'

// Hover-preview clone of a section: strips live widgets, keeps text and one media well.
const PREVIEW_MAX_BLOCKS = 5

const PREVIEW_STRIP_SEL = [
  '.ha-wrap',
  '.ha-group',
  '.ha-selection-comment-dock',
  '.collaboration-cursor__caret',
  '.collaboration-cursor__label',
  '.collaboration-cursor__avatar',
  '.ProseMirror-widget',
  '.heading-fold-crinkle',
  '.media-toolbar',
  '.hypermultimedia__resize-gripper',
  '.ProseMirror-separator',
  '.ProseMirror-trailingBreak',
  '.hm-caption',
  '.hm-loading-shell',
  '.hm-loading-shell__overlay',
  // Each of these holds a focusable control, and the clone is aria-hidden.
  '.mermaid-diagram__head',
  '.mermaid-diagram__error',
  '.pele-zoom'
].join(',')

const PREVIEW_MEDIA_SEL = 'img, video, audio, iframe'

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

function isMediaRoot(el: HTMLElement): boolean {
  return el.matches('[class*="hypermultimedia--"]') || el.matches(PREVIEW_MEDIA_SEL)
}

function hasPreviewMedia(el: HTMLElement): boolean {
  return el.matches(PREVIEW_MEDIA_SEL) || el.querySelector(PREVIEW_MEDIA_SEL) != null
}

function takeFirstMedia(root: HTMLElement): HTMLElement | null {
  if (isMediaRoot(root)) return root
  const media =
    root.querySelector<HTMLElement>('[class*="hypermultimedia--"]') ??
    root.querySelector<HTMLElement>(PREVIEW_MEDIA_SEL)
  media?.remove()
  return media ?? null
}

function stripLeftoverMedia(root: HTMLElement) {
  root.querySelectorAll('[class*="hypermultimedia--"]').forEach((node) => node.remove())
  root.querySelectorAll(PREVIEW_MEDIA_SEL).forEach((node) => node.remove())
}

function isPreviewNoise(el: HTMLElement): boolean {
  return !(el.textContent || '').replace(/\u00a0/g, ' ').trim()
}

function prunePreviewEmpties(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('p, div').forEach((el) => {
    if (el.querySelector(PREVIEW_MEDIA_SEL) || el.matches('[class*="hypermultimedia"]')) return
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
  node.querySelectorAll<HTMLElement>(PREVIEW_MEDIA_SEL).forEach((el) => {
    el.removeAttribute('width')
    el.removeAttribute('height')
    apply(el)
    el.style.objectFit = 'cover'
  })
}

function preparePreviewClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.removeAttribute('data-toc-id')
  clone.removeAttribute('contenteditable')
  clone.classList.remove('heading-fold-hidden')
  clone.style.paddingRight = '0'
  clone.querySelectorAll(PREVIEW_STRIP_SEL).forEach((node) => node.remove())
  clone.querySelectorAll('[contenteditable]').forEach((node) => {
    node.removeAttribute('contenteditable')
  })
  clone.querySelectorAll('video, audio').forEach((media) => {
    const el = media as HTMLMediaElement
    el.removeAttribute('autoplay')
    el.controls = false
    el.preload = 'metadata'
    el.pause()
  })
  clone.querySelectorAll('iframe').forEach((frame) => {
    frame.setAttribute('tabindex', '-1')
    frame.setAttribute('loading', 'lazy')
  })
  clone.querySelectorAll('svg.pele').forEach((svg) => svg.setAttribute('tabindex', '-1'))
  // Duplicate ids would clash with the live diagram. Its url(#id) refs still resolve to it.
  clone.querySelectorAll('.mermaid-diagram [id]').forEach((node) => node.removeAttribute('id'))
  return clone
}

export function mountSectionPreview(host: HTMLElement, headingId: string, fallback: string) {
  host.replaceChildren()
  const sources = collectSectionElements(headingId)
  if (!sources.length) {
    host.textContent = fallback
    return
  }

  const prose = document.createElement('div')
  prose.className =
    'tiptap ProseMirror text-base-content min-h-0 px-2.5 pt-2 pb-1.5 text-xs leading-relaxed [&_.ha-wrap]:hidden [&_a]:text-primary [&_hr]:hidden [&_ol]:my-0.5 [&_pre]:p-1.5 [&_pre]:text-[10px] [&_ul]:my-0.5 [&_:is(h1,h2,h3,h4,h5,h6)]:!mt-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!mb-1 [&_:is(h1,h2,h3,h4,h5,h6)]:!pr-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!line-clamp-2 [&_:is(h1,h2,h3,h4,h5,h6)]:!text-sm [&_:is(h1,h2,h3,h4,h5,h6)]:!font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:!leading-snug [&_:is(h1,h2,h3,h4,h5,h6)]:!text-base-content'
  const body = document.createElement('div')
  body.className = 'text-base-content/70 [overflow-wrap:anywhere] line-clamp-3 [&_p]:!my-0'
  let heading: HTMLElement | null = null
  let media: HTMLElement | null = null

  for (const source of sources) {
    const clone = preparePreviewClone(source)
    const taken = takeFirstMedia(clone)
    if (taken && !media && hasPreviewMedia(taken)) media = taken
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

  if (heading) prose.appendChild(heading)
  if (body.childNodes.length && !isPreviewNoise(body)) prose.appendChild(body)
  if (!prose.childNodes.length && fallback) prose.textContent = fallback
  if (prose.childNodes.length) host.appendChild(prose)

  if (media && hasPreviewMedia(media)) {
    const well = document.createElement('div')
    well.className = 'bg-base-200 h-24 w-full overflow-hidden'
    fitPreviewMediaCover(media)
    well.appendChild(media)
    host.appendChild(well)
  }
}
