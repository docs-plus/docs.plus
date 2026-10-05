import { AddCommentSVG, ChatLeftSVG, ChatOutlineSVG } from '@icons'
import { buildTextCommentAnchor, publishDocumentComment } from '@services/commentAnchor'
import { CHAT_OPEN } from '@services/eventsHub'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { type Editor, type ProseMirrorNode, TIPTAP_NODES } from '@types'
import * as PubSub from 'pubsub-js'

import {
  createDecorationPluginProps,
  createDecorationPluginState
} from '../../plugins/decorationHelpers'
import { HEADING_ACTIONS_CLASSES, type HeadingNodeData } from '../types'

type WidgetFactory = (view: EditorView, getPos: () => number | undefined) => HTMLElement

const createChatButton = (headingId: string, editor: Editor): HTMLButtonElement => {
  const button = document.createElement('button')
  button.classList.add(
    HEADING_ACTIONS_CLASSES.chatBtn,
    'inline-flex',
    'size-11',
    'min-h-11',
    'shrink-0',
    'items-center',
    'justify-center'
  )
  button.setAttribute('type', 'button')
  button.setAttribute('title', 'Open chat')
  button.dataset.headingId = headingId

  Object.assign(button.style, {
    userSelect: 'none',
    webkitUserSelect: 'none',
    msUserSelect: 'none'
  })

  const isMobile = Boolean(document.querySelector('.mobileLayoutRoot.m_mobile'))
  button.innerHTML = isMobile
    ? ChatOutlineSVG({ size: 20, className: 'chatLeft' })
    : ChatLeftSVG({
        size: 20,
        className: 'chatLeft',
        fill: 'currentColor'
      })

  button.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    PubSub.publish(CHAT_OPEN, { headingId })

    const { selection } = editor.state
    if (!selection.empty) {
      editor.commands.setTextSelection(selection.to)
    }
  })

  return button
}

const createCommentButton = (headingId: string, editor: Editor): HTMLButtonElement => {
  const button = document.createElement('button')
  button.classList.add(
    HEADING_ACTIONS_CLASSES.commentBtn,
    'inline-flex',
    'size-11',
    'min-h-11',
    'shrink-0',
    'items-center',
    'justify-center'
  )
  button.setAttribute('type', 'button')
  button.setAttribute('title', 'Add comment')

  button.innerHTML = AddCommentSVG({ size: 22, fill: 'currentColor' })

  button.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const { selection } = editor.state
    if (selection.empty) return

    publishDocumentComment(
      buildTextCommentAnchor(
        headingId,
        editor.state.doc.textBetween(selection.from, selection.to, '\n')
      )
    )

    editor.commands.setTextSelection(selection.to)
  })

  return button
}

const createHoverChatWidget = (editor: Editor, headingId: string): WidgetFactory => {
  return () => {
    const wrapper = document.createElement('div')
    wrapper.classList.add(HEADING_ACTIONS_CLASSES.wrap)
    wrapper.dataset.headingId = headingId

    const singleBtn = createChatButton(headingId, editor)
    singleBtn.classList.add(HEADING_ACTIONS_CLASSES.single)

    const group = document.createElement('div')
    group.classList.add(HEADING_ACTIONS_CLASSES.group)
    group.appendChild(createChatButton(headingId, editor))
    group.appendChild(createCommentButton(headingId, editor))

    wrapper.appendChild(singleBtn)
    wrapper.appendChild(group)

    return wrapper
  }
}

const findHeadingNodes = (doc: ProseMirrorNode): HeadingNodeData[] => {
  const result: HeadingNodeData[] = []

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const headingId = (node.attrs['toc-id'] as string) || null
      result.push({ to: pos + node.nodeSize, headingId })
      return false
    }
  })

  return result
}

const createHoverChatDecorations = (doc: ProseMirrorNode, editor: Editor): DecorationSet => {
  const decos: Decoration[] = []
  const headingNodes = findHeadingNodes(doc)

  headingNodes.forEach(({ to, headingId }: HeadingNodeData) => {
    if (!headingId) return

    const decorationWidget = Decoration.widget(to - 1, createHoverChatWidget(editor, headingId), {
      side: -1,
      key: `hover-chat-${headingId}`,
      ignoreSelection: true
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

let activeWrapper: HTMLElement | null = null
let lastSelectionHeadingId: string | null = null

const findSelectionHeadingId = (view: EditorView): string | null => {
  const { selection } = view.state
  if (selection.empty) return null

  const { $anchor } = selection
  if ($anchor.parent.type.name === TIPTAP_NODES.HEADING_TYPE) {
    return ($anchor.parent.attrs['toc-id'] as string) || null
  }

  return null
}

const updateSelectionState = (view: EditorView): void => {
  const headingId = findSelectionHeadingId(view)

  if (headingId === lastSelectionHeadingId) return
  lastSelectionHeadingId = headingId

  if (activeWrapper) {
    activeWrapper.classList.remove(HEADING_ACTIONS_CLASSES.hasSelection)
    activeWrapper = null
  }

  if (!headingId) return

  const wrapper = view.dom.querySelector<HTMLElement>(
    `.${HEADING_ACTIONS_CLASSES.wrap}[data-heading-id="${headingId}"]`
  )
  if (wrapper) {
    wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    activeWrapper = wrapper
  }
}

/**
 * `.ha-wrap` of the nearest heading at or before this top-level block, or null.
 * The schema is flat, so that heading owns the innermost section that holds the block.
 */
const findSectionWrapper = (view: EditorView, el: Element): HTMLElement | null => {
  try {
    const { doc } = view.state
    const pos = view.posAtDOM(el, 0)
    const $pos = doc.resolve(pos)
    let index = $pos.index(0)
    // A top-level widget, such as the fold crinkle, resolves to the node after it.
    // Step back to the node it follows.
    if ($pos.depth === 0 && view.nodeDOM(pos) !== el) index -= 1

    for (let i = index; i >= 0; i--) {
      if (doc.child(i).type.name !== TIPTAP_NODES.HEADING_TYPE) continue
      const headingDom = view.nodeDOM($pos.posAtIndex(i, 0)) as HTMLElement | null
      return (
        headingDom?.querySelector<HTMLElement>(`:scope > .${HEADING_ACTIONS_CLASSES.wrap}`) ?? null
      )
    }
  } catch (error) {
    // posAtDOM throws a RangeError for DOM that ProseMirror does not own.
    if (!(error instanceof RangeError)) throw error
  }
  return null
}

export function createHoverChatPlugin(editor: Editor): Plugin {
  const targetNodeTypes = [TIPTAP_NODES.HEADING_TYPE]

  const buildDecorations = (doc: ProseMirrorNode): DecorationSet =>
    createHoverChatDecorations(doc, editor)

  return new Plugin({
    key: new PluginKey('hoverChat'),
    state: createDecorationPluginState(buildDecorations, targetNodeTypes),
    props: createDecorationPluginProps(),
    view(editorView) {
      let frame = 0
      let target: EventTarget | null = null
      let wrapper: HTMLElement | null = null
      let sheet: HTMLElement | null = null

      // The class sits on widget DOM, which DOMObserver ignores, so it costs no re-render.
      const setWrapper = (next: HTMLElement | null): void => {
        if (next === wrapper) return
        wrapper?.classList.remove(HEADING_ACTIONS_CLASSES.sectionHover)
        next?.classList.add(HEADING_ACTIONS_CLASSES.sectionHover)
        wrapper = next
      }

      const syncSectionHover = (): void => {
        const { dom } = editorView
        // A block gap targets view.dom itself. Keep the current class there:
        // no layout read, and no flicker between blocks.
        if (!(target instanceof Element) || target === dom || !dom.contains(target)) return

        let el: Element = target
        while (el.parentElement && el.parentElement !== dom) el = el.parentElement
        setWrapper(findSectionWrapper(editorView, el))
      }

      const clearSectionHover = (): void => {
        cancelAnimationFrame(frame)
        frame = 0
        target = null
        setWrapper(null)
      }

      // The class clears when the pointer leaves the sheet, not view.dom, so it holds
      // across the sheet padding on the way to the button. Tiptap mounts view.dom
      // into the sheet after view() runs, so the sheet is found on a move.
      const watchSheet = (): void => {
        if (sheet?.contains(editorView.dom)) return
        sheet?.removeEventListener('pointerleave', clearSectionHover)
        sheet = editorView.dom.closest<HTMLElement>('.tiptap__editor') ?? editorView.dom
        sheet.addEventListener('pointerleave', clearSectionHover)
      }

      // A native listener, not handleDOMEvents: ProseMirror skips those for events
      // that a node view's stopEvent claims, such as a media caption.
      const onPointerMove = (event: PointerEvent): void => {
        if (event.pointerType === 'touch') return
        watchSheet()
        target = event.target
        if (frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          syncSectionHover()
        })
      }

      editorView.dom.addEventListener('pointermove', onPointerMove)

      return {
        update: (view: EditorView) => {
          updateSelectionState(view)
        },
        destroy: () => {
          editorView.dom.removeEventListener('pointermove', onPointerMove)
          sheet?.removeEventListener('pointerleave', clearSectionHover)
          clearSectionHover()
        }
      }
    }
  })
}
