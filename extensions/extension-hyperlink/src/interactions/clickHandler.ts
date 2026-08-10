// Pointer interaction — owns every click/touch surface that opens
// the preview popover or routes navigation through the safety gate
// (mousedown swallow, click-to-popover, middle-click new-tab,
// touchend-to-popover).

import { getMarkRange } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { SAFE_WINDOW_FEATURES } from '../constants'
import { getDefaultController } from '../floating-popover'
import { buildPreviewOptionsFromAnchor } from '../openers/buildPreviewOptionsFromAnchor'
import { openPreviewHyperlink } from '../openers/openPreviewHyperlink'
import type { LinkContext } from './types'

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

/** Single navigation gate for every surface (readonly window.open, middle-click). */
function isNavigable(href: string | null | undefined, ctx: LinkContext): href is string {
  return ctx.urls.forRead(href).navigable
}

// `null` from the popover slot is the host opt-out signal (mobile bottom
// sheet). With no slot configured at all, a read-only editor falls back to
// a gated `window.open`.
function openPreviewPopoverFromClick(
  view: EditorView,
  link: HTMLAnchorElement,
  ctx: LinkContext,
  clickPos: number | undefined
): boolean {
  const opts = buildPreviewOptionsFromAnchor({
    editor: ctx.editor,
    link,
    validate: ctx.validate,
    // Synthesize from `forRead` so the popover's "Open" honours the same composed gate as click/aux.
    isAllowedUri: (uri: string) => ctx.urls.forRead(uri).navigable
  })
  // Use the stored attr; `link.href` resolves against `document.baseURI` and would leak the host origin.
  const href = opts.attrs.href ?? link.getAttribute('href')
  // `||` not `??` — `link.target` is `''` when unset, and we want `_blank` (matches auxclick + intent).
  const targetAttr = link.target || opts.attrs.target || '_blank'

  if (!ctx.previewPopover) {
    if (!view.editable && isNavigable(href, ctx)) {
      window.open(href, targetAttr, SAFE_WINDOW_FEATURES)
    }
    return !view.editable
  }

  if (!href) {
    getDefaultController().close()
    return true
  }

  // Route through the canonical opener (slot resolution + `'preview'` adopt).
  // Caret placement is gated on a successful mount: focusing the editor on
  // host opt-out scrolls the contenteditable into view on iOS Safari.
  const mounted = openPreviewHyperlink(opts)

  if (!mounted) return true

  if (clickPos !== undefined) {
    const { from, to } = view.state.selection
    // `enableClickSelection` expands caret-into-link to the full mark range; read-only
    // editors bypass this (mutating selection there would surprise selection-driven UIs).
    if (ctx.options.enableClickSelection && view.editable && from === to) {
      const range = getMarkRange(view.state.doc.resolve(clickPos), ctx.type)
      if (range) {
        ctx.editor.chain().focus(clickPos).setTextSelection(range).run()
      } else {
        ctx.editor
          .chain()
          .focus(clickPos === 0 ? 'start' : clickPos)
          .run()
      }
    } else {
      // A non-empty selection survives the click (capture-phase mousedown is swallowed),
      // so restore the selection only when it overlaps the clicked link. Otherwise
      // edit/remove would target a stale range somewhere else in the document.
      const clickedRange = getMarkRange(view.state.doc.resolve(clickPos), ctx.type)
      const overlaps = !!clickedRange && from < clickedRange.to && to > clickedRange.from
      const pos = from === to || !overlaps ? clickPos : { from, to }
      ctx.editor
        .chain()
        .focus(clickPos === 0 ? 'start' : clickPos)
        .setTextSelection(pos)
        .run()
    }
  }

  return true
}

export function createClickHandlerInteraction(ctx: LinkContext): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkClickHandler'),

    // Three capture-phase listeners (mousedown / click / auxclick) intercept
    // ProseMirror's default link-handling. The listeners own the click semantics,
    // prevent default navigation (tabnabbing, `javascript:`), and route
    // middle-click through the navigation gate.
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
        const { attrs } = buildPreviewOptionsFromAnchor({ editor: ctx.editor, link })
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
          return openPreviewPopoverFromClick(view, link, ctx, pos?.pos)
        },

        click: (view: EditorView, event: MouseEvent) => {
          if (event.button !== 0) return false

          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false

          event.preventDefault()
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
          return openPreviewPopoverFromClick(view, link, ctx, pos?.pos)
        }
      }
    }
  })
}
