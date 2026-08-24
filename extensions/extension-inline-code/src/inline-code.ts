import { InputRule, Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'

export interface InlineCodeOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * `inputRegex` is end-anchored and non-global: a global flag moves the input-rule
 * plugin's `lastIndex` and throws "Position out of range". `pasteRegex` stays
 * global to scan a paste. Prefix guard is a lookbehind — an in-match prefix gets eaten.
 */
export const inputRegex = /(?<=^|[^`])`([^`]+)`(?!`)$/
export const pasteRegex = /(?<=^|[^`])`([^`]+)`(?!`)/g

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineCode: {
      setInlineCode: () => ReturnType
      toggleInlineCode: () => ReturnType
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

  // Upstream `@tiptap/extension-code` parity. Without these a host that loads
  // `@tiptap/markdown` serializes the marked text with no backticks, so every
  // code span silently degrades to prose on export.
  markdownTokenName: 'codespan',

  parseMarkdown: (token, helpers) =>
    helpers.applyMark('inlineCode', [{ type: 'text', text: token.text || '' }]),

  renderMarkdown: (node, helpers) => `\`${helpers.renderChildren(node)}\``,

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
        // inclusive code mark. Clear the stored mark so the next char is plain.
        // No space is inserted (core's `exitable` handler would insert one).
        // `Selection.atEnd` also covers a last textblock nested in blockquote/list.
        if (
          $from.pos !== Selection.atEnd(doc).from ||
          !this.type.isInSet(storedMarks ?? $from.marks())
        ) {
          return false
        }
        // `false` still dispatches `tr` — it only declines the keypress, so the
        // browser keeps its native motion (in RTL, ArrowRight moves the caret).
        return editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.removeStoredMark(this.type))
          return false
        })
      }
    }
  },

  addInputRules() {
    const rule = markInputRule({ find: inputRegex, type: this.type })
    return [
      new InputRule({
        find: rule.find,
        // `HardBreak.renderText()` yields a newline, which `[^`]+` matches, so
        // a span would form across the break. A leaf with no `renderText` is
        // worse: core falls back to the 6-character `%leaf%` for one position
        // and the skewed range can land outside the block.
        handler: (props) => {
          const { from, to } = props.range
          if (from < 0) return null
          let spansInlineLeaf = false
          props.state.doc.nodesBetween(from, to, (node) => {
            if (node.isInline && !node.isText) spansInlineLeaf = true
          })
          return spansInlineLeaf ? null : rule.handler(props)
        }
      })
    ]
  },

  addPasteRules() {
    return [markPasteRule({ find: pasteRegex, type: this.type })]
  }
})
