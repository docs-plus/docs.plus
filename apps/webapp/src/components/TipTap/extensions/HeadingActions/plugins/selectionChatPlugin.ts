import { AddCommentSVG } from '@icons'
import { buildTextCommentAnchorFromEditor, publishDocumentComment } from '@services/commentAnchor'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { type Editor, type EditorView, type Selection, TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import { HEADING_ACTIONS_CLASSES } from '../types'

const BUTTON_HALF_SIZE = 22 // half of size-11 (2.75rem) for vertical centering
const DEFAULT_RIGHT_POSITION = '9px'

const shouldShow = (editor: Editor): boolean => {
  const { state, view } = editor
  const { from, to, empty } = state.selection
  const hasText = state.doc.textBetween(from, to).length > 0

  // Don't show if selection is in a heading (hoverChatPlugin handles that)
  const isInHeading = state.selection.$anchor.parent.type.name === TIPTAP_NODES.HEADING_TYPE

  return view.hasFocus() && editor.isEditable && !empty && hasText && !isInHeading
}

let cachedButton: HTMLButtonElement | null = null
let cachedClickHandler: (() => void) | null = null

const getOrCreateButton = (): HTMLButtonElement => {
  if (cachedButton) return cachedButton

  cachedButton = document.createElement('button')
  cachedButton.innerHTML = AddCommentSVG({ size: 22, fill: 'currentColor' })
  cachedButton.classList.add(
    HEADING_ACTIONS_CLASSES.commentBtn,
    'inline-flex',
    'size-11',
    'min-h-11',
    'shrink-0',
    'items-center',
    'justify-center',
    'z-1'
  )
  cachedButton.setAttribute('title', 'Add comment')
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

  if (cachedClickHandler) {
    button.removeEventListener('click', cachedClickHandler)
  }
  cachedClickHandler = () => openChatComment(editor)
  button.addEventListener('click', cachedClickHandler)

  updateButtonPosition(button, view, selection)

  if (!button.parentNode) {
    parentNode.appendChild(button)
  }
}

const openChatComment = (editor: Editor): void => {
  const anchor = buildTextCommentAnchorFromEditor(editor)
  if (!anchor) {
    logger.error('[selectionChat]: No headingId found')
    return
  }

  publishDocumentComment(anchor)
  editor.commands.setTextSelection(editor.state.selection.to)
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
          return false
        },
        mousedown: () => {
          hideSelectionChatButton()
          return false
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
