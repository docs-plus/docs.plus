import { Mark, mergeAttributes, markInputRule, markPasteRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export interface InlineCodeOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * Regular expressions to match inline code blocks enclosed in backticks.
 * It matches:
 *   - An opening backtick, followed by
 *   - Any text that doesn't include a backtick (captured for marking), followed by
 *   - A closing backtick.
 * This ensures that any text between backticks is formatted as code,
 * regardless of the surrounding characters (exception being another backtick).
 */
export const inputRegex = /(^|[^`])`([^`]+)`(?!`)/g

/**
 * Matches inline code while pasting.
 */
export const pasteRegex = /(^|[^`])`([^`]+)`(?!`)/g

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineCode: {
      /**
       * Set an inline code mark
       */
      setInlineCode: () => ReturnType
      /**
       * Toggle an inline code mark
       */
      toggleInlineCode: () => ReturnType
      /**
       * Unset an inline code mark
       */
      unsetInlineCode: () => ReturnType
    }
  }
}

export const InlineCode = Mark.create<InlineCodeOptions>({
  name: 'inlineCode',

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  parseHTML() {
    return [
      {
        tag: 'code',
        getAttrs: (node) => {
          // Only match inline code, not code blocks
          return (node as HTMLElement).parentElement?.tagName !== 'PRE' ? {} : false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['code', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setInlineCode:
        () =>
        ({ state, dispatch, tr }) => {
          const { selection } = state
          const { from, to, empty } = selection

          if (dispatch) {
            if (empty) {
              // No selection - insert zero-width space with inline code mark
              const text = '\u200B' // zero-width space
              tr.insertText(text, from)
              tr.addMark(from, from + text.length, this.type.create())
              tr.setSelection(TextSelection.create(tr.doc, from + text.length))
            } else {
              // Has selection - wrap it
              tr.addMark(from, to, this.type.create())
            }
          }

          return true
        },

      unsetInlineCode:
        () =>
        ({ state, dispatch, tr }) => {
          const { selection } = state
          const { from, to } = selection

          if (dispatch) {
            tr.removeMark(from, to, this.type)
          }

          return true
        },

      toggleInlineCode:
        () =>
        ({ state, dispatch, tr, editor }) => {
          const { selection } = state
          const { from, to, empty } = selection

          if (dispatch) {
            const isActive = editor.isActive('inlineCode')

            if (isActive) {
              // Remove inline code mark
              tr.removeMark(from, to, this.type)
            } else {
              if (empty) {
                // No selection - insert zero-width space with inline code mark
                const text = '\u200B' // zero-width space
                tr.insertText(text, from)
                tr.addMark(from, from + text.length, this.type.create())
                tr.setSelection(TextSelection.create(tr.doc, from + text.length))
              } else {
                // Has selection - wrap it
                tr.addMark(from, to, this.type.create())
              }
            }
          }

          return true
        }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleInlineCode(),
      'Mod-e': () => this.editor.commands.toggleInlineCode(),
      ArrowRight: ({ editor }) => {
        const { state, view } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're at the end of an inline code mark
        if (selection.empty && $from.marks().some((mark: any) => mark.type === this.type)) {
          const pos = $from.pos
          const nextPos = pos + 1

          // Check if we're at the end of the document
          if (nextPos >= state.doc.content.size) {
            // Insert a space after the code tag and move cursor there
            const tr = state.tr
            tr.insertText(' ', pos)
            tr.removeMark(pos, pos + 1, this.type)
            tr.setSelection(TextSelection.create(tr.doc, pos + 1))
            view.dispatch(tr)
            return true
          }

          // Check if the next position doesn't have the inline code mark
          const $nextPos = state.doc.resolve(nextPos)
          if (!$nextPos.marks().some((mark: any) => mark.type === this.type)) {
            editor.commands.setTextSelection(nextPos)
            return true
          }
        }

        return false
      },
      ArrowLeft: ({ editor }) => {
        const { state, view } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're at the start of an inline code mark
        if (selection.empty && $from.marks().some((mark: any) => mark.type === this.type)) {
          const pos = $from.pos
          const prevPos = pos - 1

          // Check if we're at the beginning of the document or inline code
          if (prevPos <= 0) {
            // Insert a space at current position and remove code mark from it
            const tr = state.tr
            tr.insertText(' ', pos)
            tr.removeMark(pos, pos + 1, this.type)
            tr.setSelection(TextSelection.create(tr.doc, pos))
            view.dispatch(tr)
            return true
          }

          // Check if the previous position doesn't have the inline code mark
          const $prevPos = state.doc.resolve(prevPos)
          if (!$prevPos.marks().some((mark: any) => mark.type === this.type)) {
            editor.commands.setTextSelection(prevPos)
            return true
          }
        }

        return false
      }
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: inputRegex,
        type: this.type
      })
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: pasteRegex,
        type: this.type
      })
    ]
  }
})
