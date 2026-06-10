import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'

export interface InlineCodeOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * Backtick-delimited inline code (`` `code` ``). `inputRegex` is end-anchored and
 * non-global: a global flag drifts the input-rule plugin's `lastIndex` and throws
 * "Position out of range". `pasteRegex` keeps the global flag to scan a paste.
 */
export const inputRegex = /(^|[^`])`([^`]+)`(?!`)$/
export const pasteRegex = /(^|[^`])`([^`]+)`(?!`)/g

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineCode: {
      /** Apply the inline-code mark (collapsed caret → stored mark, no inserted char). */
      setInlineCode: () => ReturnType
      /** Toggle the inline-code mark. */
      toggleInlineCode: () => ReturnType
      /** Remove the inline-code mark. */
      unsetInlineCode: () => ReturnType
    }
  }
}

export const InlineCode = Mark.create<InlineCodeOptions>({
  name: 'inlineCode',

  // Outrank StarterKit's `code` mark (priority 100) so backtick input + Mod-e
  // produce inlineCode when a host leaves StarterKit's `code` enabled (README).
  priority: 101,

  // Upstream `@tiptap/extension-code` parity: code text never stacks other marks.
  excludes: '_',

  // `@tiptap/core` suppresses other extensions' input rules inside code-marked
  // text only via this spec flag (Typography/bold rules must not rewrite code).
  code: true,

  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },

  parseHTML() {
    return [
      {
        tag: 'code',
        // CodeBlock owns `<pre><code>`; only a bare `<code>` is inline code.
        getAttrs: (node) => ((node as HTMLElement).parentElement?.tagName !== 'PRE' ? {} : false)
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['code', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  // Entry rides ProseMirror stored marks: on a collapsed caret these seed the
  // mark for the next char without inserting a zero-width space into the doc.
  addCommands() {
    return {
      setInlineCode:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleInlineCode:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetInlineCode:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name)
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-e': () => this.editor.commands.toggleInlineCode(),
      ArrowRight: ({ editor }) => {
        const { selection, doc, storedMarks } = editor.state
        if (!selection.empty) return false
        const { $from } = selection
        // At the very end of the document the default arrow can't move out of an
        // inclusive code mark — clear the stored mark so the next char is plain.
        // No space is inserted (core's `exitable` handler would insert one).
        // `Selection.atEnd` also covers a last textblock nested in blockquote/list.
        if (
          $from.pos !== Selection.atEnd(doc).from ||
          !this.type.isInSet(storedMarks ?? $from.marks())
        ) {
          return false
        }
        return editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.removeStoredMark(this.type))
          return true
        })
      }
    }
  },

  addInputRules() {
    return [markInputRule({ find: inputRegex, type: this.type })]
  },

  addPasteRules() {
    return [markPasteRule({ find: pasteRegex, type: this.type })]
  }
})
