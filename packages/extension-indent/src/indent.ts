import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Configuration options for the Indent extension
 */
export interface IndentOptions {
  /**
   * Character(s) to insert for each indentation
   * @default '  ' (2 spaces)
   */
  indentChars: string

  /**
   * Whether the extension is enabled
   * @default true
   */
  enabled: boolean

  /**
   * List of node types that can accept indentation
   * If not provided or empty, all nodes will be indented
   * @default ['paragraph', 'listItem', 'orderedList']
   */
  allowedNodeTypes?: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /**
       * Add indentation at cursor position or to selected content
       */
      indent: () => ReturnType
      /**
       * Remove indentation at cursor position or from selected content
       */
      outdent: () => ReturnType
    }
  }
}

/**
 * Indent Extension for Tiptap
 *
 * Provides functionality to indent and outdent text in the editor.
 */
export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      indentChars: '  ',
      enabled: true,
      allowedNodeTypes: ['paragraph', 'listItem', 'orderedList']
    }
  },

  addCommands() {
    /**
     * Checks if the current node type is allowed for indentation
     * @param state - Editor state
     * @returns boolean indicating if indentation is allowed
     */
    const isNodeAllowed = (state: any) => {
      const { allowedNodeTypes } = this.options

      if (!allowedNodeTypes?.length) return true

      const $pos = state.selection.$from
      const node = $pos.node()

      return allowedNodeTypes.includes(node.type.name)
    }

    return {
      /**
       * Adds indentation at cursor position or to selected content
       */
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          if (!this.options.enabled || !isNodeAllowed(state)) return false

          const { selection } = state
          const { indentChars } = this.options

          // Handle empty selection (cursor position)
          if (selection.empty) {
            if (dispatch) {
              tr.insertText(indentChars, selection.from, selection.to)
              dispatch(tr)
            }
            return true
          }

          // Handle multiline selection
          const lines = state.doc.textBetween(selection.from, selection.to).split('\n')
          let pos = selection.from

          if (dispatch) {
            for (const line of lines) {
              const lineStart = pos
              const lineEnd = lineStart + line.length

              tr.insertText(indentChars, lineStart, lineStart)
              pos = lineEnd + indentChars.length + 1 // +1 for newline
            }

            dispatch(tr)
          }

          return true
        },

      /**
       * Removes indentation at cursor position or from selected content
       */
      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          if (!this.options.enabled || !isNodeAllowed(state)) return false

          const { selection } = state
          const { indentChars } = this.options
          let madeChanges = false

          // Handle empty selection (cursor position)
          if (selection.empty) {
            const $cursor = (selection as TextSelection).$cursor
            if (!$cursor) return false

            const cursorPos = $cursor.pos
            const lineStart = state.doc.resolve(cursorPos).start()
            const textBeforeCursor = state.doc.textBetween(lineStart, cursorPos)
            const isAtLineStart = cursorPos === lineStart

            // Check if there are indentation characters to remove
            if (textBeforeCursor.endsWith(indentChars)) {
              if (dispatch) {
                tr.delete(cursorPos - indentChars.length, cursorPos)
                madeChanges = true
              }
            } else if (isAtLineStart && textBeforeCursor.startsWith(indentChars)) {
              if (dispatch) {
                tr.delete(lineStart, lineStart + indentChars.length)
                madeChanges = true
              }
            }

            if (dispatch) {
              if (!madeChanges) {
                tr.setSelection(TextSelection.create(tr.doc, cursorPos))
              }
              dispatch(tr)
            }

            return true
          }

          // Handle multiline selection
          const lines = state.doc.textBetween(selection.from, selection.to).split('\n')
          let pos = selection.from

          if (dispatch) {
            for (const line of lines) {
              const lineStart = pos

              if (line.startsWith(indentChars)) {
                tr.delete(lineStart, lineStart + indentChars.length)
                pos = lineStart + line.length - indentChars.length + 1
              } else {
                pos = lineStart + line.length + 1
              }
            }

            dispatch(tr)
          }

          return true
        }
    }
  },

  /**
   * Add keyboard shortcuts for indent/outdent functionality
   */
  addKeyboardShortcuts() {
    return {
      Tab: () => (this.options.enabled ? this.editor.commands.indent() : false),
      'Shift-Tab': () => (this.options.enabled ? this.editor.commands.outdent() : false)
    }
  }
})

export const indentCSS = null // No CSS needed for this approach
