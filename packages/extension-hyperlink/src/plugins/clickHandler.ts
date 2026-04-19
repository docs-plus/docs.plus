import { Editor } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

import {
  createFloatingToolbar,
  DEFAULT_OFFSET,
  hideCurrentToolbar
} from '../helpers/floatingToolbar'
import type { HyperlinkAttributes, PreviewHyperlinkOptions } from '../hyperlink'
import { DANGEROUS_SCHEME_RE } from '../utils/validateURL'

type ClickHandlerOptions = {
  type: MarkType
  editor: Editor
  validate?: (url: string) => boolean
  popover?: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
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

function showPopover(
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
  const targetAttr = link.target || attrs.target

  if (!options.popover) {
    if (href && !view.editable && !DANGEROUS_SCHEME_RE.test(href)) {
      window.open(href, targetAttr ?? undefined)
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
    validate: options.validate
  })

  if (!content) {
    hideCurrentToolbar()
    return true
  }

  // Desktop popover path: anchor the caret at the link so subsequent
  // in-popover actions (edit, remove) operate on the right mark.
  if (clickPos !== undefined) {
    const { from, to } = view.state.selection
    const pos = from === to ? clickPos : { from, to }
    options.editor
      .chain()
      .focus(clickPos === 0 ? 'start' : clickPos)
      .setTextSelection(pos)
      .run()
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

    // Two capture-phase listeners work together:
    // 1. mousedown + stopPropagation: ProseMirror tracks mousedown
    //    position and fires handleSingleClick on mouseup — which reaches
    //    showPopover's no-popover fallback and calls window.open.
    //    Stopping mousedown propagation prevents that entire path.
    // 2. click + preventDefault (no stopPropagation): prevents browser
    //    default navigation for target="_blank" links, but lets the event
    //    bubble so handleDOMEvents.click can show the popover.
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

      editorView.dom.addEventListener('mousedown', preventMouseDown, true)
      editorView.dom.addEventListener('click', preventClick, true)
      return {
        destroy() {
          editorView.dom.removeEventListener('mousedown', preventMouseDown, true)
          editorView.dom.removeEventListener('click', preventClick, true)
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
          return showPopover(view, link, options, pos?.pos)
        },

        click: (view: EditorView, event: MouseEvent) => {
          if (event.button !== 0) return false

          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false

          event.preventDefault()
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
          return showPopover(view, link, options, pos?.pos)
        }
      }
    }
  })
}
