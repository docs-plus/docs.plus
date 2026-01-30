/**
 * This component provides testing hooks for critical editor operations like copy/paste.
 * It renders invisible buttons that can be triggered programmatically or via keyboard shortcuts.
 * These buttons are critical for automated testing with Cypress and provide a consistent way
 * to trigger clipboard operations across different browsers and environments.
 *
 * */

import { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { useClipboardListener } from './hooks/useClipboardListener'
import { useClipboardShortcuts } from './hooks/useClipboardShortcuts'
import { useHierarchicalSelection } from './hooks/useHierarchicalSelection'
/**
 * Controllers Component
 *
 * This component provides testing hooks and advanced selection utilities
 * for the editor, including hierarchical selection and clipboard operations.
 */
type SelectionLevel = 'element' | 'parent' | 'section' | 'heading' | 'list' | 'document'

type ControllersProps = {
  editor: Editor | null
  debug?: boolean
}

const Controllers = ({ editor, debug = false }: ControllersProps) => {
  const [isTestEnv, setIsTestEnv] = useState(false)

  useEffect(() => {
    setIsTestEnv(
      process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_DEBUG_CONTROLLERS === 'true'
    )
  }, [])

  // Clipboard shortcuts
  useClipboardShortcuts()
  useClipboardListener()
  // Hierarchical selection utilities
  const { selectHierarchical, selectElement } = useHierarchicalSelection(editor)

  // Copy selected content
  const copySelectedContent = () => {
    if (!editor) return

    editor.commands.focus()
    const copyEvent = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true
    })
    document.activeElement?.dispatchEvent(copyEvent)
    if (!copyEvent.defaultPrevented) {
      document.execCommand('copy')
    }

    console.info('[Controllers] Copy operation triggered')
  }

  // Paste from clipboard
  const pasteFromClipboard = () => {
    if (!editor) return

    editor.commands.focus()
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true
    })
    document.activeElement?.dispatchEvent(pasteEvent)
    if (!pasteEvent.defaultPrevented) {
      document.execCommand('paste')
    }

    console.info('[Controllers] Paste operation triggered')
  }

  // Select hierarchically and then copy
  const selectAndCopy = (level: SelectionLevel) => {
    if (!editor) return
    selectHierarchical(level)
    setTimeout(() => copySelectedContent(), 10)
  }

  // Expose selection methods globally
  useEffect(() => {
    if (!editor) return

    // @ts-ignore
    window._editorSelectAndCopy = selectAndCopy
    // @ts-ignore
    window._editorSelect = selectHierarchical
    // @ts-ignore
    window._editorSelectElement = selectElement

    return () => {
      // @ts-ignore
      delete window._editorSelectAndCopy
      // @ts-ignore
      delete window._editorSelect
      // @ts-ignore
      delete window._editorSelectElement
    }
  }, [editor, selectHierarchical, selectElement])

  const buttonClasses =
    debug || isTestEnv
      ? 'p-2 bg-blue-500 text-white text-xs rounded m-1'
      : 'opacity-0 pointer-events-auto m-1'

  return (
    <div className="controller-buttons absolute top-0 right-0 z-50 flex flex-col items-end">
      {/* Clipboard controls */}
      <div className="flex">
        <button
          onClick={copySelectedContent}
          id="btn_copyselectedcontent"
          className={buttonClasses}
          aria-label="Copy selected text"
          title="Copy selected text (like Cmd+C)"
          data-testid="copy-button">
          {debug || isTestEnv ? 'Copy' : ''}
        </button>

        <button
          onClick={pasteFromClipboard}
          id="btn_pastefromclipboard"
          className={buttonClasses}
          aria-label="Paste from clipboard"
          title="Paste from clipboard (like Cmd+V)"
          data-testid="paste-button">
          {debug || isTestEnv ? 'Paste' : ''}
        </button>
      </div>

      {/* Selection controls */}
      {(debug || isTestEnv) && (
        <div className="mt-2 flex max-w-xs flex-wrap justify-end">
          <button
            onClick={() => selectHierarchical('element')}
            id="btn_select_element"
            className={buttonClasses}
            data-testid="select-element">
            Select Element
          </button>

          <button
            onClick={() => selectHierarchical('parent')}
            id="btn_select_parent"
            className={buttonClasses}
            data-testid="select-parent">
            Select Parent
          </button>

          <button
            onClick={() => selectHierarchical('section')}
            id="btn_select_section"
            className={buttonClasses}
            data-testid="select-section">
            Select Section
          </button>

          <button
            onClick={() => selectHierarchical('heading')}
            id="btn_select_heading"
            className={buttonClasses}
            data-testid="select-heading">
            Select Heading
          </button>

          <button
            onClick={() => selectHierarchical('list')}
            id="btn_select_list"
            className={buttonClasses}
            data-testid="select-list">
            Select List
          </button>

          <button
            onClick={() => selectHierarchical('document')}
            id="btn_select_document"
            className={buttonClasses}
            data-testid="select-document">
            Select All
          </button>
        </div>
      )}
    </div>
  )
}

export default Controllers
