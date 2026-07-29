import { Editor } from '@tiptap/react'
import { useCallback } from 'react'

// Support array-like objects (e.g., Cypress returns jQuery-like objects)
type ElementOrArrayLike = HTMLElement | ArrayLike<HTMLElement>

type SelectionLevel = 'element' | 'parent' | 'section' | 'heading' | 'list' | 'document'

/**
 * Widens the DOM selection from the caret to the nearest ancestor matching the requested
 * level; `section` means the enclosing `h1[data-toc-id]`, the docs.plus heading section.
 */
export const useHierarchicalSelection = (editor: Editor | null) => {
  const selectHierarchical = useCallback(
    (level: SelectionLevel = 'element') => {
      if (!editor) return false

      const { selection } = editor.state

      console.log('selection', { selection })
      if (!selection) return false

      const element = editor.view.domAtPos(selection.from)?.node as HTMLElement
      console.log('element', { element })
      if (!element) return false

      let targetElement: HTMLElement | null

      switch (level) {
        case 'element':
          targetElement = element.closest('p, li, h1, h2, h3, h4, h5, h6') as HTMLElement
          break

        case 'parent': {
          const immediateElement = element.closest('p, li, h1, h2, h3, h4, h5, h6') as HTMLElement
          targetElement = immediateElement?.parentElement as HTMLElement
          break
        }

        case 'section':
          targetElement = element.closest('h1[data-toc-id]') as HTMLElement
          break

        case 'heading':
          targetElement = element.closest('h1, h2, h3, h4, h5, h6') as HTMLElement
          break

        case 'list':
          targetElement = element.closest('ul, ol') as HTMLElement
          break

        case 'document':
          editor.commands.selectAll()
          return true

        default:
          targetElement = element.closest('p, li, h1, h2, h3, h4, h5, h6') as HTMLElement
      }

      if (targetElement) {
        const doc = targetElement.ownerDocument
        const range = doc.createRange()
        const selection = doc.getSelection()

        range.selectNodeContents(targetElement)
        selection?.removeAllRanges()
        selection?.addRange(range)

        // Update Tiptap's internal selection state
        setTimeout(() => {
          editor.commands.focus()
        }, 0)

        return true
      }

      return false
    },
    [editor]
  )

  const selectElement = useCallback(
    (domElement: ElementOrArrayLike) => {
      if (!editor) return false

      try {
        // Handle both direct HTMLElements and array-like objects (Cypress)
        const element =
          domElement instanceof HTMLElement ? domElement : (domElement as ArrayLike<HTMLElement>)[0]

        if (!element) return false

        const doc = element.ownerDocument
        if (!doc) return false

        const range = doc.createRange()
        const selection = window.getSelection()

        range.selectNodeContents(element)
        selection?.removeAllRanges()
        selection?.addRange(range)

        // Update Tiptap's internal selection state
        setTimeout(() => {
          editor.commands.focus()
        }, 0)

        return true
      } catch (error) {
        console.error('Error selecting element:', error)
        return false
      }
    },
    [editor]
  )

  return {
    selectHierarchical,
    selectElement
  }
}
