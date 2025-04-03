import { Extension } from '@tiptap/core'
import { TextSelection } from 'prosemirror-state'

export interface IndentOptions {
  /**
   * Character(s) to insert for each indentation
   */
  indentChars: string
  /**
   * Whether to use the extension
   */
  enabled: boolean
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

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      indentChars: '  ', // 2 spaces by default
      enabled: true
    }
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          if (!this.options.enabled) {
            return false
          }

          const { selection } = state
          const { indentChars } = this.options

          if (selection.empty) {
            // No selection, just insert the indentation at cursor
            if (dispatch) {
              tr.insertText(indentChars, selection.from, selection.to)
              dispatch(tr)
            }
            return true
          }

          // Handle multiline selection
          const lines = state.doc.textBetween(selection.from, selection.to).split('\n')
          const startPos = selection.from

          if (dispatch) {
            // For each line in the selection, add indentation at the start
            let pos = startPos

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]
              const lineStart = pos
              const lineEnd = lineStart + line.length

              // Add indentation at the start of the line
              tr.insertText(indentChars, lineStart, lineStart)

              // Update position for the next line
              pos = lineEnd + indentChars.length + 1 // +1 for the newline
            }

            dispatch(tr)
          }

          return true
        },

      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          if (!this.options.enabled) {
            return false
          }

          const { selection } = state
          const { indentChars } = this.options
          let madeChanges = false

          if (selection.empty) {
            // Check if there are spaces before the cursor to remove
            const $cursor = (selection as TextSelection).$cursor
            if (!$cursor) return false

            const cursorPos = $cursor.pos
            const lineStart = state.doc.resolve(cursorPos).start()

            // Check if the cursor is at the beginning of the line
            const isAtLineStart = cursorPos === lineStart

            // Get text from start of line to cursor position
            const textBeforeCursor = state.doc.textBetween(lineStart, cursorPos)

            if (textBeforeCursor.endsWith(indentChars)) {
              // Remove spaces right before the cursor
              if (dispatch) {
                tr.delete(cursorPos - indentChars.length, cursorPos)
                madeChanges = true
              }
            } else if (isAtLineStart && textBeforeCursor.startsWith(indentChars)) {
              // Only remove spaces from beginning if cursor is at the start of line
              if (dispatch) {
                tr.delete(lineStart, lineStart + indentChars.length)
                madeChanges = true
              }
            }

            // Even if we didn't make changes, dispatch the transaction to maintain selection
            if (dispatch) {
              if (!madeChanges) {
                // If we didn't make changes, just re-apply the current selection
                tr.setSelection(TextSelection.create(tr.doc, cursorPos))
              }
              dispatch(tr)
            }

            // Always return true to prevent the cursor from disappearing
            return true
          }

          // Handle multiline selection
          const lines = state.doc.textBetween(selection.from, selection.to).split('\n')
          const startPos = selection.from

          if (dispatch) {
            let pos = startPos

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]
              const lineStart = pos

              // Check if line starts with indent chars and remove them if so
              if (line.startsWith(indentChars)) {
                tr.delete(lineStart, lineStart + indentChars.length)
                madeChanges = true

                // Update position accounting for the removed indentation
                pos = lineStart + line.length - indentChars.length + 1 // +1 for newline
              } else {
                // Line wasn't indented, just move to the next line
                pos = lineStart + line.length + 1 // +1 for newline
              }
            }

            // Dispatch even if we didn't make changes to maintain selection
            dispatch(tr)
          }

          // Always return true to prevent the cursor from disappearing
          return true
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => (this.options.enabled ? this.editor.commands.indent() : false),
      'Shift-Tab': () => (this.options.enabled ? this.editor.commands.outdent() : false)
    }
  }
})

export const indentCSS = null // No CSS needed for this approach
