import { type CommandProps, type Editor, Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'

/** Table commands come from @tiptap/extension-table when present — not declared on core Editor types. */
function tryGoToNextCell(editor: Editor): boolean {
  const commands = editor.commands as { goToNextCell?: () => boolean }
  const can = editor.can() as { goToNextCell?: () => boolean }
  if (can.goToNextCell?.()) {
    return commands.goToNextCell?.() ?? false
  }
  return false
}

function tryGoToPreviousCell(editor: Editor): boolean {
  const commands = editor.commands as { goToPreviousCell?: () => boolean }
  const can = editor.can() as { goToPreviousCell?: () => boolean }
  if (can.goToPreviousCell?.()) {
    return commands.goToPreviousCell?.() ?? false
  }
  return false
}

function listItemTypeNames(editor: Editor): string[] {
  const { nodes } = editor.state.schema
  const out: string[] = []
  if (nodes.listItem) out.push('listItem')
  if (nodes.taskItem) out.push('taskItem')
  return out
}

function trySinkListItem(editor: Editor): boolean {
  for (const name of listItemTypeNames(editor)) {
    if (editor.can().sinkListItem(name)) {
      return editor.commands.sinkListItem(name)
    }
  }
  return false
}

function tryLiftListItem(editor: Editor): boolean {
  for (const name of listItemTypeNames(editor)) {
    if (editor.can().liftListItem(name)) {
      return editor.commands.liftListItem(name)
    }
  }
  return false
}

/** Resolved textblock + its immediate block parent; used for indent/outdent gating. */
export type IndentContext = { textblockName: string; parentName: string }

/**
 * One allowed context for literal `indent` / `outdent`: a **textblock** type and its **immediate
 * parent's** type (TipTap / ProseMirror `type.name`, e.g. `paragraph` + `doc`).
 */
export type IndentContextRule = {
  textblock: string
  parent: string
}

const defaultAllowedIndentContexts: IndentContextRule[] = [
  { textblock: 'paragraph', parent: 'doc' },
  { textblock: 'paragraph', parent: 'blockquote' }
]

/**
 * Innermost textblock at `pos` and its immediate block parent (`doc`, `listItem`, `blockquote`, …).
 * @internal exported for unit tests
 */
export function indentContextAtPos(doc: Node, pos: number): IndentContext | null {
  const $pos = doc.resolve(pos)
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.isTextblock) {
      const parent = $pos.node(d - 1)
      return { textblockName: node.type.name, parentName: parent.type.name }
    }
  }
  return null
}

export interface IndentOptions {
  /**
   * @default '  ' (2 spaces)
   */
  indentChars: string

  /**
   * @default true
   */
  enabled: boolean

  /**
   * Full `(textblock, parent)` type-name allowlist for literal indent/outdent — `configure()` replaces
   * the whole list (no merge). `[]` disables literal indent; Tab still sinks lists and moves table cells.
   * @default `paragraph` under `doc`, and `paragraph` under `blockquote`
   */
  allowedIndentContexts: IndentContextRule[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

function contextMatchesAllowedIndent(
  ctx: IndentContext | null,
  rules: IndentContextRule[]
): boolean {
  if (!ctx || rules.length === 0) return false
  return rules.some((r) => r.textblock === ctx.textblockName && r.parent === ctx.parentName)
}

function isIndentContextAllowed(
  state: EditorState,
  pos: number,
  rules: IndentContextRule[]
): boolean {
  const ctx = indentContextAtPos(state.doc, pos)
  return contextMatchesAllowedIndent(ctx, rules)
}

function isCaretContextAllowed(state: EditorState, rules: IndentContextRule[]): boolean {
  return isIndentContextAllowed(state, state.selection.from, rules)
}

/** A selected visual line: its full text from line start and resolved document start position. */
type IndentLine = { text: string; pos: number }

/** Outdent deletes by position, not by measured chars: hop zero-width leaves (e.g. hardBreak). */
function skipZeroWidthLeaves(doc: Node, pos: number): number {
  let p = pos
  for (let node = doc.nodeAt(p); node && node.isLeaf && !node.isText; node = doc.nodeAt(p)) {
    p += node.nodeSize
  }
  return p
}

/**
 * One linear walk over the selected textblocks. Each line is targeted at its content start, so a
 * selection beginning mid-line still indents from the line start, and each line's text is read to
 * the block end so leading-indent checks see the full line. Empty blocks are not visual lines.
 * Returns `false` if any line sits in a disallowed context.
 */
function multilineLinesIfAllowed(
  state: EditorState,
  rules: IndentContextRule[]
): false | IndentLine[] {
  const lines: IndentLine[] = []
  let disallowed = false

  // A `CellSelection` exposes only its head cell on `from`/`to`; the rest of the rectangle
  // is reachable through `ranges`. Every other selection type has exactly one range.
  for (const { $from, $to } of state.selection.ranges) {
    const from = $from.pos
    const to = $to.pos

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (disallowed) return false
      if (!node.isTextblock) return true

      const start = pos + 1
      const end = start + node.content.size
      // `nodesBetween` also yields a block the selection merely touches at a
      // boundary (Shift-Down landing on the next block's first position). A line
      // needs at least one selected position, or Tab aborts on the block beyond it.
      if (Math.max(from, start) < Math.min(to, end)) {
        if (!isIndentContextAllowed(state, start, rules)) {
          disallowed = true
          return false
        }
        lines.push({ text: node.textContent, pos: start })
      }
      // Textblocks hold inline content only — no nested line to find.
      return false
    })

    if (disallowed) return false
  }

  return lines
}

/**
 * Indent extension: line-prefix indent/outdent with Tab precedence delegated to
 * list and table commands (see keyboard shortcuts).
 */
export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  priority: 25,

  addOptions() {
    return {
      indentChars: '  ',
      enabled: true,
      allowedIndentContexts: defaultAllowedIndentContexts
    }
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          if (!this.options.enabled || !this.options.indentChars) return false

          const { selection } = state
          const { indentChars } = this.options
          const rules = this.options.allowedIndentContexts

          if (selection.empty) {
            if (!isCaretContextAllowed(state, rules)) return false
            if (dispatch) {
              tr.insertText(indentChars, selection.from, selection.to)
              dispatch(tr)
            }
            return true
          }

          const lines = multilineLinesIfAllowed(state, rules)
          if (lines === false) return false
          if (lines.length === 0) return false

          if (dispatch) {
            const positions = lines.map(({ pos }) => pos).sort((a, b) => b - a)
            for (const p of positions) {
              tr.insertText(indentChars, p, p)
            }
            dispatch(tr)
          }

          return true
        },

      outdent:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          if (!this.options.enabled || !this.options.indentChars) return false

          const { selection } = state
          const { indentChars } = this.options
          const rules = this.options.allowedIndentContexts

          if (selection.empty) {
            if (!isCaretContextAllowed(state, rules)) return false
            const $cursor = (selection as TextSelection).$cursor
            if (!$cursor) return false

            const cursorPos = $cursor.pos
            const lineStart = $cursor.start()
            const textBeforeCursor = state.doc.textBetween(lineStart, cursorPos)
            const isAtLineStart = cursorPos === lineStart

            // Deletes count positions while the checks count chars; the window equality
            // refuses to delete zero-width leaves (e.g. hardBreak) in place of indent chars.
            const removeTrailing =
              textBeforeCursor.length >= indentChars.length &&
              state.doc.textBetween(cursorPos - indentChars.length, cursorPos) === indentChars
            // At line start there is no text before the cursor, so look forward at
            // the line's own leading indent (else Shift-Tab at line start is a no-op).
            const lineLeading = isAtLineStart ? state.doc.textBetween(lineStart, $cursor.end()) : ''
            const removeLeading =
              isAtLineStart &&
              lineLeading.startsWith(indentChars) &&
              state.doc.textBetween(lineStart, lineStart + indentChars.length) === indentChars

            if (!removeTrailing && !removeLeading) {
              return false
            }

            if (dispatch) {
              if (removeTrailing) {
                tr.delete(cursorPos - indentChars.length, cursorPos)
              } else {
                tr.delete(lineStart, lineStart + indentChars.length)
              }
              dispatch(tr)
            }

            return true
          }

          const lines = multilineLinesIfAllowed(state, rules)
          if (lines === false) return false

          const toDelete = lines
            .filter(({ text }) => text.startsWith(indentChars))
            .map(({ pos }) => skipZeroWidthLeaves(state.doc, pos))
            .filter((p) => state.doc.textBetween(p, p + indentChars.length) === indentChars)
          if (toDelete.length === 0) {
            return false
          }

          if (dispatch) {
            for (const p of toDelete.sort((a, b) => b - a)) {
              tr.delete(p, p + indentChars.length)
            }
            dispatch(tr)
          }

          return true
        }
    }
  },

  addKeyboardShortcuts() {
    const handleTab = (dir: 'forward' | 'back'): boolean => {
      if (!this.options.enabled) return false

      const editor = this.editor

      if (dir === 'forward') {
        if (trySinkListItem(editor)) return true
        if (tryGoToNextCell(editor)) return true
        return editor.commands.indent()
      }

      if (tryLiftListItem(editor)) return true
      if (tryGoToPreviousCell(editor)) return true
      return editor.commands.outdent()
    }

    return {
      Tab: () => handleTab('forward'),
      'Shift-Tab': () => handleTab('back')
    }
  }
})
