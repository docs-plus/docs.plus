import { Editor } from '@tiptap/react'
import { useCallback } from 'react'
import jQuery from 'jquery'

// Define JQuery interface
interface JQuery<TElement = HTMLElement> extends Array<TElement> {
  [index: number]: TElement
}

type SelectionLevel = 'element' | 'parent' | 'section' | 'heading' | 'list' | 'document'

/**
 * Hook to handle hierarchical selection based on current caret position
 *
 * This allows selecting content based on the document hierarchy:
 * - element: selects the current element (paragraph, list item, etc.)
 * - parent: selects the parent container of the current element
 * - section: selects the entire section containing the current element
 * - heading: selects the nearest heading and all its content
 * - list: selects the entire list if within a list
 * - document: selects the entire document
 */
export const useHierarchicalSelection = (editor: Editor | null) => {
  /**
   * Select content hierarchically based on current caret position
   */
  const selectHierarchical = useCallback(
    (level: SelectionLevel = 'element') => {
      if (!editor) return false

      // Get the current selection
      const { selection } = editor.state

      console.log('selection', { selection })
      if (!selection) return false

      // Get the DOM node at the current selection
      const element = editor.view.domAtPos(selection.from)?.node as HTMLElement
      console.log('element', { element })
      if (!element) return false

      let targetElement: HTMLElement | null = null

      // Find the appropriate element to select based on the requested level
      switch (level) {
        case 'element':
          // Find the closest paragraph, list item, etc.
          targetElement = element.closest('p, li, h1, h2, h3, h4, h5, h6') as HTMLElement
          break

        case 'parent':
          // Find the parent container
          const immediateElement = element.closest('p, li, h1, h2, h3, h4, h5, h6') as HTMLElement
          targetElement = immediateElement?.parentElement as HTMLElement
          break

        case 'section':
          // Find the section container
          targetElement = element.closest('.heading[level="1"]') as HTMLElement
          break

        case 'heading':
          // Find the nearest heading
          console.log('heading', { element })
          targetElement = element.closest('.heading') as HTMLElement
          console.log('targetElement', { targetElement })
          break

        case 'list':
          // Find the entire list
          targetElement = element.closest('ul, ol') as HTMLElement
          break

        case 'document':
          // Select entire document
          editor.commands.selectAll()
          return true

        default:
          targetElement = element.closest('p, li, h1, h2, h3, h4, h5, h6') as HTMLElement
      }

      // If we found a target element, select it
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

  /**
   * Select the content of the specified DOM element
   */
  const selectElement = useCallback(
    (domElement: HTMLElement | JQuery<HTMLElement>) => {
      if (!editor) return false

      try {
        // Handle both DOM elements and Cypress/jQuery objects
        const element =
          domElement instanceof HTMLElement ? domElement : (domElement as JQuery<HTMLElement>)[0]

        if (!element) return false

        const doc = element.ownerDocument
        if (!doc) return false

        const range = doc.createRange()
        const selection = window.getSelection()

        // Select the entire element content
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
