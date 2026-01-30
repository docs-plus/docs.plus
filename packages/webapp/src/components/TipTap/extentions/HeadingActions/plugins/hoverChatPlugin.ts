import { AddCommentMD,ChatLeftSVG } from '@icons'
import { CHAT_COMMENT,CHAT_OPEN } from '@services/eventsHub'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { type Editor,type ProseMirrorNode, TIPTAP_NODES } from '@types'
import * as PubSub from 'pubsub-js'

import {
  createDecorationPluginProps,
  createDecorationPluginState} from '../../plugins/decorationHelpers'
import { HEADING_ACTIONS_CLASSES, type HeadingNodeData } from '../types'

/** ProseMirror widget factory signature */
type WidgetFactory = (view: EditorView, getPos: () => number | undefined) => HTMLElement

const createChatButton = (headingId: string, editor: Editor): HTMLButtonElement => {
  const button = document.createElement('button')
  button.classList.add(
    HEADING_ACTIONS_CLASSES.hoverChatBtn,
    'btnOpenChatBox',
    'btn',
    'btn-circle',
    'btn-primary',
    'size-12',
    'min-h-10',
    'shadow-md',
    'tooltip',
    'tooltip-right'
  )
  button.setAttribute('type', 'button')
  button.setAttribute('data-tip', 'Open chat')
  button.dataset.headingId = headingId

  Object.assign(button.style, {
    userSelect: 'none',
    webkitUserSelect: 'none',
    msUserSelect: 'none'
  })

  button.innerHTML = ChatLeftSVG({
    size: 20,
    className: 'chatLeft',
    fill: '#fff'
  })

  button.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    PubSub.publish(CHAT_OPEN, { headingId })

    // Clear selection after opening chat
    const { selection } = editor.state
    if (!selection.empty) {
      editor.commands.setTextSelection(selection.to)
    }
  })

  return button
}

/**
 * Creates the comment button element (for selection)
 */
const createCommentButton = (headingId: string, editor: Editor): HTMLButtonElement => {
  const button = document.createElement('button')
  button.classList.add(
    HEADING_ACTIONS_CLASSES.selectionChatBtn,
    'btn',
    'btn-circle',
    'btn-primary',
    'size-12',
    'min-h-10',
    'shadow-md',
    'tooltip',
    'tooltip-right'
  )
  button.setAttribute('type', 'button')
  button.setAttribute('data-tip', 'Add comment')

  button.innerHTML = AddCommentMD({ size: 22, fill: '#fff' })

  button.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const { selection } = editor.state
    if (selection.empty) return

    PubSub.publish(CHAT_COMMENT, {
      content: editor.state.doc.textBetween(selection.from, selection.to, '\n'),
      html: '',
      headingId
    })

    // Clear selection after opening comment
    editor.commands.setTextSelection(selection.to)
  })

  return button
}

const createHoverChatWidget = (editor: Editor, headingId: string): WidgetFactory => {
  return () => {
    // Wrapper element
    const wrapper = document.createElement('div')
    wrapper.classList.add(HEADING_ACTIONS_CLASSES.hoverWrapper)
    wrapper.dataset.headingId = headingId

    // Single chat button (default state)
    const singleBtn = createChatButton(headingId, editor)
    singleBtn.classList.add('ha-single')

    // Grouped buttons (when selection exists in this heading)
    const group = document.createElement('div')
    group.classList.add(HEADING_ACTIONS_CLASSES.hoverGroup)
    group.appendChild(createChatButton(headingId, editor))
    group.appendChild(createCommentButton(headingId, editor))

    wrapper.appendChild(singleBtn)
    wrapper.appendChild(group)

    return wrapper
  }
}

const findHeadingNodes = (doc: ProseMirrorNode): HeadingNodeData[] => {
  const result: HeadingNodeData[] = []
  let lastHeadingId: string | null = null

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      result.push({ to: pos + node.nodeSize, headingId: lastHeadingId })
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

// Track the currently active wrapper to clear it efficiently
let activeWrapper: HTMLElement | null = null

/**
 * Finds the heading ID that contains the current selection
 */
const findSelectionHeadingId = (view: EditorView): string | null => {
  const { selection } = view.state

  const isInContentHeading =
    !selection.empty && selection.$anchor.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE

  if (!isInContentHeading) return null

  const $from = selection.$from
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      return node.attrs.id
    }
  }

  return null
}

/**
 * Updates selection state on hover wrappers
 */
const updateSelectionState = (view: EditorView): void => {
  // Clear previous
  if (activeWrapper) {
    activeWrapper.classList.remove(HEADING_ACTIONS_CLASSES.hasSelection)
    activeWrapper = null
  }

  // Find heading with selection
  const headingId = findSelectionHeadingId(view)
  if (!headingId) return

  // Update wrapper
  const wrapper = view.dom.querySelector<HTMLElement>(
    `.${HEADING_ACTIONS_CLASSES.hoverWrapper}[data-heading-id="${headingId}"]`
  )
  if (wrapper) {
    wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    activeWrapper = wrapper
  }
}

/**
 * Creates the hover chat plugin
 * Shows a chat button inside each heading's content area on hover
 * Shows additional comment button when text is selected in that heading
 */
export function createHoverChatPlugin(editor: Editor): Plugin {
  const targetNodeTypes = [TIPTAP_NODES.HEADING_TYPE, TIPTAP_NODES.CONTENT_HEADING_TYPE]

  const buildDecorations = (doc: ProseMirrorNode): DecorationSet =>
    createHoverChatDecorations(doc, editor)

  return new Plugin({
    key: new PluginKey('hoverChat'),
    state: createDecorationPluginState(buildDecorations, targetNodeTypes),
    props: createDecorationPluginProps(),
    view() {
      return {
        update: (view: EditorView) => {
          updateSelectionState(view)
        }
      }
    }
  })
}
