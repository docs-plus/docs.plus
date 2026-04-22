import { Editor } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

import { SAFE_WINDOW_FEATURES } from '../constants'
import {
  createFloatingToolbar,
  DEFAULT_OFFSET,
  hideCurrentToolbar
} from '../helpers/floatingToolbar'
import type { HyperlinkAttributes, PreviewHyperlinkOptions } from '../hyperlink'
import { isSafeHref } from '../utils/validateURL'

type ClickHandlerOptions = {
  type: MarkType
  editor: Editor
  validate?: (url: string) => boolean
  /**
   * Composed XSS + `isAllowedUri` gate. Mirrors the gate used at every
   * write boundary so readonly navigation and middle-click obey the
   * same policy that controls insertion. Defaults to `isSafeHref` for
   * backwards compatibility when the plugin is wired by hand.
   */
  isAllowedUri?: (uri: string) => boolean
  popover?: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
  /**
   * When `true`, clicking inside an existing hyperlink in editable
   * mode selects the entire link range (the user can then style /
   * delete the whole link in one motion). Defaults to `false` to
   * preserve the legacy click-to-preview behaviour.
   */
  enableClickSelection?: boolean
}

/**
 * Walk outward from `pos` along marks of `type` to recover the
 * `[from, to)` doc range covered by the hyperlink mark at the click.
 *
 * ProseMirror exposes the mark via `nodeAt(pos).marks` but no helper
 * to find the contiguous range — implement it directly so
 * `enableClickSelection` can place a real selection over the link.
 */
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

/**
 * Composed gate used for every navigation surface this plugin exposes
 * (readonly window.open, middle-click). Always rejects dangerous
 * schemes; then runs the user's `isAllowedUri` policy when supplied.
 * Plain `isSafeHref` is the floor when no policy was wired through.
 */
function isNavigable(
  href: string | null | undefined,
  options: ClickHandlerOptions
): href is string {
  if (!isSafeHref(href)) return false
  return options.isAllowedUri ? options.isAllowedUri(href) : true
}

/**
 * Open the hyperlink floating toolbar (preview popover or fallback
 * `window.open`) for the link the user just clicked.
 *
 * Three branches:
 *   1. No popover configured + read-only editor → `window.open(href)`
 *      under the composed XSS + `isAllowedUri` gate.
 *   2. Popover configured but returns `null` → host opted out (e.g.
 *      mobile bottom sheet); dismiss the toolbar without focusing.
 *   3. Popover returns content → mount the floating toolbar anchored
 *      to the live `<a>` and place the caret at the click position.
 */
function openHyperlinkToolbar(
  view: EditorView,
  link: HTMLAnchorElement,
  options: ClickHandlerOptions,
  clickPos: number | undefined
): boolean {
  const nodePos = view.posAtDOM(link, 0)
  const attrs = getMarkAttrsAtPos(view, nodePos, options.type)
  // Prefer the stored mark attr — `link.href` resolves relative URLs
  // against `document.baseURI` and would leak the host page's origin
  // into window.open for bare-domain hrefs.
  const href = attrs.href ?? link.getAttribute('href')
  // `link.target` is `''` when the attribute is unset (truthy-falsy
  // through `||`), and `attrs.target` is `string | null`. Default to
  // `_blank` so the read-only fallback opens a new tab — matches the
  // auxclick branch and the "open in new tab" intent of clicking a
  // link in a non-editable doc. An empty string here would open in
  // the current window.
  const targetAttr = link.target || attrs.target || '_blank'

  if (!options.popover) {
    if (!view.editable && isNavigable(href, options)) {
      window.open(href, targetAttr, SAFE_WINDOW_FEATURES)
    }
    return !view.editable
  }

  if (!href) {
    hideCurrentToolbar()
    return true
  }

  const linkCoords = getLinkCoordinates(link)

  // Invoke the popover handler FIRST. A `null` return is the contract
  // by which a host can opt out of the floating-toolbar UI (e.g. to
  // render a mobile bottom sheet instead). When the host opts out we
  // must NOT focus the editor or update its selection — on iOS Safari
  // calling `.focus()` on a contenteditable triggers a synchronous
  // "scroll focused element into view", and the host typically wants
  // the editor's caret/keyboard left untouched while its sheet opens.
  const content = options.popover({
    editor: options.editor,
    view,
    link,
    nodePos,
    attrs,
    linkCoords,
    validate: options.validate,
    // Pass the composed gate down so the preview popover's "Open"
    // button honors the same `isAllowedUri` policy as click + middle-
    // click. Without this, a tightened policy would silently leak
    // through the popover's anchor click.
    isAllowedUri: options.isAllowedUri
  })

  if (!content) {
    hideCurrentToolbar()
    return true
  }

  // Desktop popover path: anchor the caret at the link so subsequent
  // in-popover actions (edit, remove) operate on the right mark.
  if (clickPos !== undefined) {
    const { from, to } = view.state.selection
    // `enableClickSelection`: when the editor is editable AND the user
    // didn't already drag-select something, expand the caret into a
    // full mark-range selection so they can re-style or delete the
    // whole link in one shot. Read-only editors bypass this — mutating
    // the selection in a read-only doc would surprise hosts that use
    // it for selection-driven UI.
    if (options.enableClickSelection && view.editable && from === to) {
      const range = getHyperlinkRangeAtPos(view, clickPos, options.type)
      if (range) {
        options.editor.chain().focus(clickPos).setTextSelection(range).run()
      } else {
        options.editor
          .chain()
          .focus(clickPos === 0 ? 'start' : clickPos)
          .run()
      }
    } else {
      const pos = from === to ? clickPos : { from, to }
      options.editor
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
    showArrow: true
  })

  toolbar.show()
  return true
}

export default function clickHandlerPlugin(options: ClickHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkClickHandler'),

    // Three capture-phase listeners work together:
    // 1. mousedown + stopPropagation: ProseMirror tracks primary-button
    //    mousedown position and fires handleSingleClick on mouseup —
    //    which would reach openHyperlinkToolbar's no-popover fallback
    //    and call window.open. Stopping mousedown propagation prevents
    //    that entire path so we own the click semantics.
    // 2. click + preventDefault (no stopPropagation): prevents the
    //    browser's default navigation (target="_blank" tabnabbing
    //    surface, javascript: hrefs) but lets the event bubble so
    //    handleDOMEvents.click can show the popover.
    // 3. auxclick + preventDefault: middle-click (and other non-primary
    //    buttons) bypass `click` entirely. Without this listener a
    //    middle-click would open the raw <a href> in a new tab — which
    //    skips both `isAllowedUri` and `noopener,noreferrer`. Route it
    //    through the same navigation gate, opening in `_blank` to match
    //    the user's intent.
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
        // event.button === 1 is the middle button. Browsers also fire
        // auxclick for the right button (button === 2) — ignore that
        // so the native context menu still works.
        if (event.button !== 1) return
        const link = findLinkFromEvent(event, editorView.dom)
        if (!link) return
        event.preventDefault()
        event.stopPropagation()
        const nodePos = editorView.posAtDOM(link, 0)
        const attrs = getMarkAttrsAtPos(editorView, nodePos, options.type)
        const href = attrs.href ?? link.getAttribute('href')
        if (isNavigable(href, options)) {
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
          return openHyperlinkToolbar(view, link, options, pos?.pos)
        },

        click: (view: EditorView, event: MouseEvent) => {
          if (event.button !== 0) return false

          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false

          event.preventDefault()
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
          return openHyperlinkToolbar(view, link, options, pos?.pos)
        }
      }
    }
  })
}
