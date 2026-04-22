// Pointer interaction — owns every click/touch surface that opens
// the preview popover or routes navigation through the safety gate
// (mousedown swallow, click-to-popover, middle-click new-tab,
// touchend-to-popover).

import type { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { SAFE_WINDOW_FEATURES } from '../constants'
import {
  createFloatingToolbar,
  DEFAULT_OFFSET,
  hideCurrentToolbar
} from '../helpers/floatingToolbar'
import type { HyperlinkAttributes } from '../hyperlink'
import type { LinkContext } from './types'

/** Walk outward from `pos` to recover `[from, to)` of the hyperlink mark — used by `enableClickSelection`. */
function getHyperlinkRangeAtPos(
  view: EditorView,
  pos: number,
  type: MarkType
): { from: number; to: number } | null {
  const { doc } = view.state
  const $pos = doc.resolve(pos)
  const node = $pos.nodeAfter ?? $pos.nodeBefore
  const mark = node?.marks.find((m) => m.type === type)
  if (!mark) return null

  let from = pos
  let to = pos
  while (from > 0) {
    const prev = doc.nodeAt(from - 1)
    if (!prev || !prev.marks.some((m) => m.eq(mark))) break
    from -= 1
  }
  while (to < doc.content.size) {
    const next = doc.nodeAt(to)
    if (!next || !next.marks.some((m) => m.eq(mark))) break
    to += 1
  }
  return { from, to }
}

const getLinkCoordinates = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

function findLinkFromEvent(
  event: MouseEvent | TouchEvent,
  root: HTMLElement
): HTMLAnchorElement | null {
  const target = event.target as HTMLElement | null
  if (!target) return null

  const link = target.closest<HTMLAnchorElement>('a')
  if (!link || !root.contains(link)) return null

  return link
}

function getMarkAttrsAtPos(view: EditorView, pos: number, type: MarkType): HyperlinkAttributes {
  const node = view.state.doc.nodeAt(pos)
  const mark = node?.marks.find((m) => m.type === type)
  return (mark?.attrs ?? {
    href: null,
    target: null,
    rel: null,
    class: null,
    title: null,
    image: null
  }) as HyperlinkAttributes
}

/** Single navigation gate for every surface (readonly window.open, middle-click). */
function isNavigable(href: string | null | undefined, ctx: LinkContext): href is string {
  return ctx.urls.forRead(href).navigable
}

// Open the floating toolbar (preview popover or fallback `window.open`)
// for the just-clicked link. Three branches:
//   1. No popover + read-only editor → gated `window.open(href)`.
//   2. Popover returns `null` → host opted out (mobile bottom sheet).
//   3. Popover returns content → mount toolbar, place caret.
function openHyperlinkToolbar(
  view: EditorView,
  link: HTMLAnchorElement,
  ctx: LinkContext,
  clickPos: number | undefined
): boolean {
  const nodePos = view.posAtDOM(link, 0)
  const attrs = getMarkAttrsAtPos(view, nodePos, ctx.type)
  // Use the stored attr; `link.href` resolves against `document.baseURI` and would leak the host origin.
  const href = attrs.href ?? link.getAttribute('href')
  // `||` not `??` — `link.target` is `''` when unset, and we want `_blank` (matches auxclick + intent).
  const targetAttr = link.target || attrs.target || '_blank'

  if (!ctx.previewPopover) {
    if (!view.editable && isNavigable(href, ctx)) {
      window.open(href, targetAttr, SAFE_WINDOW_FEATURES)
    }
    return !view.editable
  }

  if (!href) {
    hideCurrentToolbar()
    return true
  }

  const linkCoords = getLinkCoordinates(link)

  // Invoke FIRST: a `null` return lets the host opt out (e.g. mobile bottom sheet).
  // When opting out, never `.focus()` — iOS Safari scrolls the contenteditable into view.
  const content = ctx.previewPopover({
    editor: ctx.editor,
    view,
    link,
    nodePos,
    attrs,
    linkCoords,
    validate: ctx.validate,
    // Synthesize from `forRead` so the popover's "Open" honours the same composed gate as click/aux.
    isAllowedUri: (uri: string) => ctx.urls.forRead(uri).navigable
  })

  if (!content) {
    hideCurrentToolbar()
    return true
  }

  if (clickPos !== undefined) {
    const { from, to } = view.state.selection
    // `enableClickSelection` expands caret-into-link to the full mark range; read-only
    // editors bypass this (mutating selection there would surprise selection-driven UIs).
    if (ctx.options.enableClickSelection && view.editable && from === to) {
      const range = getHyperlinkRangeAtPos(view, clickPos, ctx.type)
      if (range) {
        ctx.editor.chain().focus(clickPos).setTextSelection(range).run()
      } else {
        ctx.editor
          .chain()
          .focus(clickPos === 0 ? 'start' : clickPos)
          .run()
      }
    } else {
      const pos = from === to ? clickPos : { from, to }
      ctx.editor
        .chain()
        .focus(clickPos === 0 ? 'start' : clickPos)
        .setTextSelection(pos)
        .run()
    }
  }

  const toolbar = createFloatingToolbar({
    referenceElement: link,
    content,
    placement: 'bottom',
    offset: DEFAULT_OFFSET,
    showArrow: true,
    surface: 'preview'
  })

  toolbar.show()
  return true
}

export function createClickHandlerInteraction(ctx: LinkContext): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkClickHandler'),

    // Three capture-phase listeners (mousedown / click / auxclick) intercept ProseMirror's
    // default link-handling so we own the click semantics, prevent default navigation
    // (tabnabbing, `javascript:`), and route middle-click through the navigation gate.
    view(editorView) {
      const preventMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return
        const link = findLinkFromEvent(event, editorView.dom)
        if (!link) return
        event.preventDefault()
        event.stopPropagation()
      }

      const preventClick = (event: MouseEvent) => {
        if (event.button !== 0) return
        const link = findLinkFromEvent(event, editorView.dom)
        if (link) event.preventDefault()
      }

      const handleAuxClick = (event: MouseEvent) => {
        // Middle-button only (button === 2 = right; let the native context menu fire).
        if (event.button !== 1) return
        const link = findLinkFromEvent(event, editorView.dom)
        if (!link) return
        event.preventDefault()
        event.stopPropagation()
        const nodePos = editorView.posAtDOM(link, 0)
        const attrs = getMarkAttrsAtPos(editorView, nodePos, ctx.type)
        const href = attrs.href ?? link.getAttribute('href')
        if (isNavigable(href, ctx)) {
          window.open(href, '_blank', SAFE_WINDOW_FEATURES)
        }
      }

      editorView.dom.addEventListener('mousedown', preventMouseDown, true)
      editorView.dom.addEventListener('click', preventClick, true)
      editorView.dom.addEventListener('auxclick', handleAuxClick, true)
      return {
        destroy() {
          editorView.dom.removeEventListener('mousedown', preventMouseDown, true)
          editorView.dom.removeEventListener('click', preventClick, true)
          editorView.dom.removeEventListener('auxclick', handleAuxClick, true)
        }
      }
    },

    props: {
      handleDOMEvents: {
        touchend: (view: EditorView, event: TouchEvent) => {
          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false

          event.preventDefault()
          const { clientX, clientY } = event.changedTouches[0]
          const pos = view.posAtCoords({ left: clientX, top: clientY })
          return openHyperlinkToolbar(view, link, ctx, pos?.pos)
        },

        click: (view: EditorView, event: MouseEvent) => {
          if (event.button !== 0) return false

          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false

          event.preventDefault()
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
          return openHyperlinkToolbar(view, link, ctx, pos?.pos)
        }
      }
    }
  })
}
