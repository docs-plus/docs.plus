import { AddCommentMD } from '@icons'
import { CHAT_COMMENT } from '@services/eventsHub'
import type { ResolvedPos } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { type Editor, type EditorView,type Selection, TIPTAP_NODES } from '@types'
import PubSub from 'pubsub-js'

import { HEADING_ACTIONS_CLASSES } from '../types'

// Layout constants
const BUTTON_HALF_SIZE = 16
const DEFAULT_RIGHT_POSITION = '9px'

const findAncestorOfType = ($pos: ResolvedPos, typeName: string) => {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.name === typeName) return node
  }
  return null
}

const shouldShow = (editor: Editor): boolean => {
  const { state, view } = editor
  const { from, to, empty } = state.selection
  const hasText = state.doc.textBetween(from, to).length > 0

  // Don't show if selection is in contentHeading (hoverChatPlugin handles that)
  const isInContentHeading =
    state.selection.$anchor.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE

  return view.hasFocus() && editor.isEditable && !empty && hasText && !isInContentHeading
}

// Cached button element for performance - reuse instead of recreate
let cachedButton: HTMLButtonElement | null = null
let cachedClickHandler: (() => void) | null = null

const getOrCreateButton = (): HTMLButtonElement => {
  if (cachedButton) return cachedButton

  cachedButton = document.createElement('button')
  cachedButton.innerHTML = AddCommentMD({ size: 22, fill: '#fff' })
  cachedButton.classList.add(
    HEADING_ACTIONS_CLASSES.selectionChatBtn,
    'btn',
    'btn-circle',
    'btn-primary',
    'size-12',
    'min-h-10',
    'shadow-md',
    'z-1',
    'tooltip',
    'tooltip-right'
  )
  cachedButton.setAttribute('data-tip', 'Add comment')
  cachedButton.style.position = 'absolute'

  return cachedButton
}

const updateButtonPosition = (
  button: HTMLButtonElement,
  view: EditorView,
  selection: Selection
): void => {
  const editorElement = view.dom.closest('.tiptap__editor') as HTMLElement | null
  if (!editorElement) return

  const { from } = selection
  const { top: nodeTop } = view.coordsAtPos(from)
  const { top: editorTop } = editorElement.getBoundingClientRect()

  const offsetTop = nodeTop - editorTop
  const node = view.nodeDOM(from) as HTMLElement | null
  const nodeHeight = node?.offsetHeight ?? 0

  const adjustedTop = nodeHeight
    ? offsetTop + nodeHeight / 2 - BUTTON_HALF_SIZE
    : offsetTop - BUTTON_HALF_SIZE

  button.style.top = `${Math.round(adjustedTop)}px`
  button.style.left = 'auto'
  button.style.right = DEFAULT_RIGHT_POSITION
}

const showSelectionChatButton = (editor: Editor, view: EditorView, selection: Selection): void => {
  const parentNode = view.dom.parentNode as HTMLElement | null
  if (!parentNode) return

  const button = getOrCreateButton()

  // Update click handler with current editor
  if (cachedClickHandler) {
    button.removeEventListener('click', cachedClickHandler)
  }
  cachedClickHandler = () => openChatComment(editor)
  button.addEventListener('click', cachedClickHandler)

  // Update position
  updateButtonPosition(button, view, selection)

  // Append if not already in DOM
  if (!button.parentNode) {
    parentNode.appendChild(button)
  }
}

const openChatComment = (editor: Editor): void => {
  const { selection } = editor.state
  if (selection.empty) return

  const headingNode = findAncestorOfType(selection.$from, TIPTAP_NODES.HEADING_TYPE)
  const headingId = headingNode?.attrs.id

  if (!headingId) {
    console.error('[selectionChat]: No headingId found')
    return
  }

  PubSub.publish(CHAT_COMMENT, {
    content: editor.state.doc.textBetween(selection.from, selection.to, '\n'),
    html: '',
    headingId
  })

  // Clear selection after opening comment
  editor.commands.setTextSelection(selection.to)
}

const hideSelectionChatButton = (): void => {
  if (cachedButton?.parentNode) {
    cachedButton.remove()
  }
}

const cleanup = (): void => {
  if (cachedButton) {
    if (cachedClickHandler) {
      cachedButton.removeEventListener('click', cachedClickHandler)
    }
    cachedButton.remove()
    cachedButton = null
    cachedClickHandler = null
  }
}

/**
 * Creates the selection chat plugin
 * Shows a floating comment button when text is selected
 */
export function createSelectionChatPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('selectionChat'),
    props: {
      handleDOMEvents: {
        mouseup: (view: EditorView) => {
          if (shouldShow(editor)) {
            showSelectionChatButton(editor, view, editor.state.selection)
          } else {
            hideSelectionChatButton()
          }
          return false // Allow event to propagate to other handlers
        },
        mousedown: () => {
          hideSelectionChatButton()
          return false // Allow event to propagate
        }
      }
    },
    view() {
      return {
        destroy() {
          cleanup()
        }
      }
    }
  })
}
