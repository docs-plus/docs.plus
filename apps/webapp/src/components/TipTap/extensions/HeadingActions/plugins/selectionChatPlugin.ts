import { AddCommentSVG } from '@icons'
import { buildTextCommentAnchorFromEditor, publishDocumentComment } from '@services/commentAnchor'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { type Editor, type EditorView, type Selection, TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import { HEADING_ACTIONS_CLASSES } from '../types'

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
  cachedButton.setAttribute('type', 'button')
  cachedButton.innerHTML = AddCommentSVG({ size: 22, fill: 'currentColor' })
  cachedButton.classList.add(
    HEADING_ACTIONS_CLASSES.commentBtn,
    HEADING_ACTIONS_CLASSES.selectionCommentDock,
    'inline-flex',
    'size-11',
    'min-h-11',
    'shrink-0',
    'items-center',
    'justify-center'
  )
  cachedButton.setAttribute('title', 'Add comment')

  return cachedButton
}

const updateButtonPosition = (
  button: HTMLButtonElement,
  editorElement: HTMLElement,
  view: EditorView,
  selection: Selection
): void => {
  const { from, to } = selection
  const startCoords = view.coordsAtPos(from)
  const endCoords = view.coordsAtPos(to)
  const { top: editorTop } = editorElement.getBoundingClientRect()
  const selectionCenterY = (startCoords.top + endCoords.bottom) / 2
  const adjustedTop = selectionCenterY - editorTop - button.offsetHeight / 2

  button.style.top = `${Math.round(adjustedTop)}px`
}

const showSelectionChatButton = (editor: Editor, view: EditorView, selection: Selection): void => {
  const editorElement = view.dom.closest('.tiptap__editor') as HTMLElement | null
  if (!editorElement) return

  const button = getOrCreateButton()

  if (cachedClickHandler) {
    button.removeEventListener('click', cachedClickHandler)
  }
  cachedClickHandler = () => openChatComment(editor)
  button.addEventListener('click', cachedClickHandler)

  if (button.parentNode !== editorElement) {
    editorElement.appendChild(button)
  }
  updateButtonPosition(button, editorElement, view, selection)
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
