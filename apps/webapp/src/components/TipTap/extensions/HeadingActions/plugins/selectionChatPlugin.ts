import { canCommentInDocument } from '@hooks/isDocumentEditingLocked'
import { AddCommentSVG } from '@icons'
import { buildTextCommentAnchorFromEditor, publishDocumentComment } from '@services/commentAnchor'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { type Editor, type EditorView, type Selection, TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import { HEADING_ACTIONS_CLASSES } from '../types'

/**
 * Editable pads verify ProseMirror focus; read-only pads (`contenteditable="false"`)
 * cannot take focus, so `view.hasFocus()` is always false and we check that the
 * active DOM selection range sits inside `view.dom`.
 */
export const hasActiveSelectionInView = (
  view: Pick<EditorView, 'dom' | 'editable' | 'hasFocus'>
): boolean => {
  if (view.editable) return view.hasFocus()

  const selection = view.dom.ownerDocument.defaultView?.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  return view.dom.contains(range.startContainer) && view.dom.contains(range.endContainer)
}

const shouldShow = (view: EditorView): boolean => {
  if (!canCommentInDocument()) return false

  const { state } = view
  const { from, to, empty } = state.selection
  if (empty) return false

  const hasText = state.doc.textBetween(from, to).length > 0
  // Don't show if selection is in a heading (hoverChatPlugin handles that)
  const isInHeading = state.selection.$anchor.parent.type.name === TIPTAP_NODES.HEADING_TYPE

  return hasActiveSelectionInView(view) && hasText && !isInHeading
}

const createButton = (
  onClick: () => void,
  onBlur: (event: FocusEvent) => void
): HTMLButtonElement => {
  const button = document.createElement('button')
  button.setAttribute('type', 'button')
  button.innerHTML = AddCommentSVG({ size: 22, fill: 'currentColor' })
  button.classList.add(
    HEADING_ACTIONS_CLASSES.commentBtn,
    HEADING_ACTIONS_CLASSES.selectionCommentDock,
    'inline-flex',
    'size-11',
    'min-h-11',
    'shrink-0',
    'items-center',
    'justify-center'
  )
  button.setAttribute('title', 'Add comment')
  button.setAttribute('aria-label', 'Add comment')
  button.addEventListener('click', onClick)
  button.addEventListener('blur', onBlur)
  return button
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

const openChatComment = (editor: Editor): void => {
  if (!canCommentInDocument()) return

  const anchor = buildTextCommentAnchorFromEditor(editor)
  if (!anchor) {
    logger.error('[selectionChat]: No headingId found')
    return
  }

  publishDocumentComment(anchor)
  editor.commands.setTextSelection(editor.state.selection.to)
  if (editor.isEditable) return

  // On read-only pads, ProseMirror skips DOM selection sync when activeElement
  // does not contain view.dom, so collapse the native range inside view.dom too.
  const domSelection = editor.view.dom.ownerDocument.defaultView?.getSelection()
  if (!domSelection || domSelection.isCollapsed || domSelection.rangeCount === 0) return
  if (editor.view.dom.contains(domSelection.getRangeAt(0).startContainer)) {
    domSelection.collapseToEnd()
  }
}

export function createSelectionChatPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('selectionChat'),
    view(editorView) {
      let button: HTMLButtonElement | null = null
      let isPointerSelecting = false
      const ownerDoc = editorView.dom.ownerDocument

      const hideButton = (): void => {
        if (button?.parentNode) {
          button.remove()
        }
      }

      const onButtonClick = (): void => openChatComment(editor)

      const onButtonBlur = (event: FocusEvent): void => {
        if (event.relatedTarget !== editorView.dom && !editorView.hasFocus()) {
          hideButton()
        }
      }

      const showButton = (view: EditorView): void => {
        const editorElement = view.dom.closest('.tiptap__editor') as HTMLElement | null
        if (!editorElement) return

        if (!button) {
          button = createButton(onButtonClick, onButtonBlur)
        }
        if (button.parentNode !== editorElement) {
          editorElement.appendChild(button)
        }
        updateButtonPosition(button, editorElement, view, view.state.selection)
      }

      const reconcile = (view: EditorView): void => {
        if (isPointerSelecting || !shouldShow(view)) {
          hideButton()
          return
        }
        showButton(view)
      }

      const onMouseDown = (): void => {
        isPointerSelecting = true
        hideButton()
      }

      const onEditorMouseUp = (): void => {
        isPointerSelecting = false
        reconcile(editorView)
      }

      const onDocumentMouseUp = (): void => {
        if (!isPointerSelecting) return
        isPointerSelecting = false
        reconcile(editorView)
      }

      const onEditorBlur = (event: FocusEvent): void => {
        if (event.relatedTarget === button) return
        hideButton()
      }

      const onSelectionChange = (): void => {
        if (!editorView.editable && !isPointerSelecting) {
          reconcile(editorView)
        }
      }

      editorView.dom.addEventListener('mousedown', onMouseDown)
      editorView.dom.addEventListener('mouseup', onEditorMouseUp)
      editorView.dom.addEventListener('blur', onEditorBlur)
      ownerDoc.addEventListener('mouseup', onDocumentMouseUp)
      ownerDoc.addEventListener('selectionchange', onSelectionChange)

      return {
        update(view: EditorView) {
          reconcile(view)
        },
        destroy() {
          editorView.dom.removeEventListener('mousedown', onMouseDown)
          editorView.dom.removeEventListener('mouseup', onEditorMouseUp)
          editorView.dom.removeEventListener('blur', onEditorBlur)
          ownerDoc.removeEventListener('mouseup', onDocumentMouseUp)
          ownerDoc.removeEventListener('selectionchange', onSelectionChange)
          if (button) {
            button.removeEventListener('click', onButtonClick)
            button.removeEventListener('blur', onButtonBlur)
            button.remove()
            button = null
          }
        }
      }
    }
  })
}
