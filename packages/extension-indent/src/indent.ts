import { type CommandProps, type Editor, Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'

/** Use a single newline between blocks so `textBetween` reflects visual lines for indent/outdent. */
const MULTILINE_BLOCK_SEP = '\n'

/**
 * Non-empty visual lines in `chunk` from `doc.textBetween` — skips empty segments
 * caused by `\n\n` between blocks (split('\n') alone is wrong for position math).
 * @internal exported for unit tests
 */
export function lineTextsWithOffsets(chunk: string): Array<{ offset: number; text: string }> {
  const out: Array<{ offset: number; text: string }> = []
  let i = 0
  while (i < chunk.length) {
    if (chunk[i] === '\n') {
      i += 1
      continue
    }
    const start = i
    while (i < chunk.length && chunk[i] !== '\n') i += 1
    out.push({ offset: start, text: chunk.slice(start, i) })
  }
  return out
}

/**
 * Map a character offset in `chunk` (`doc.textBetween(from, to, blockSeparator)`) to the document
 * position where that character begins.
 *
 * Implemented with forward integer positions and repeated `textBetween(from, p)` (not incremental
 * `textBetween(p-1, p)` slices — those do not compose to the same cumulative lengths across arbitrary
 * block boundaries in all cases). Worst-case cost grows with selection span; normal selections are fine.
 * @internal exported for unit tests
 */
export function docPosAtChunkOffset(
  doc: Node,
  from: number,
  to: number,
  chunkOffset: number,
  blockSeparator: string = MULTILINE_BLOCK_SEP
): number {
  if (chunkOffset <= 0) return from
  for (let p = from; p <= to; p++) {
    if (doc.textBetween(from, p, blockSeparator).length >= chunkOffset) return p
  }
  return to
}

/** Table commands come from @tiptap/extension-table when present — not declared on core Editor types. */
function tryGoToNextCell(editor: Editor): boolean {
  const commands = editor.commands as { goToNextCell?: () => boolean }
  const can = editor.can as { goToNextCell?: () => boolean }
  if (can.goToNextCell?.()) {
    return commands.goToNextCell?.() ?? false
  }
  return false
}

function tryGoToPreviousCell(editor: Editor): boolean {
  const commands = editor.commands as { goToPreviousCell?: () => boolean }
  const can = editor.can as { goToPreviousCell?: () => boolean }
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
   * Full allowlist of **`(textblock, parent)`** contexts where literal indent/outdent runs. Each rule is
   * one pair: innermost textblock `type.name` at the caret/line and its immediate parent block’s
   * `type.name`. There are no implicit defaults merged into a partial list — configure every context
   * you need. Pass **`[]`** to disable literal indent everywhere (Tab can still sink/lift lists or move
   * table cells).
   * @default `paragraph` under `doc`, and `paragraph` under `blockquote`
   */
  allowedIndentContexts?: IndentContextRule[]
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

function contextMatchesAllowedIndent(
  ctx: IndentContext | null,
  rules: IndentContextRule[] | undefined
): boolean {
  const list = rules ?? []
  if (!ctx || list.length === 0) return false
  return list.some((r) => r.textblock === ctx.textblockName && r.parent === ctx.parentName)
}

function isIndentContextAllowed(
  state: EditorState,
  pos: number,
  rules: IndentContextRule[] | undefined
): boolean {
  const ctx = indentContextAtPos(state.doc, pos)
  return contextMatchesAllowedIndent(ctx, rules)
}

function isCaretContextAllowed(
  state: EditorState,
  rules: IndentContextRule[] | undefined
): boolean {
  return isIndentContextAllowed(state, state.selection.from, rules)
}

/**
 * One `textBetween` + parse; returns `false` if any line starts in a disallowed context.
 */
function multilineLinesIfAllowed(
  state: EditorState,
  from: number,
  to: number,
  rules: IndentContextRule[] | undefined
): false | Array<{ offset: number; text: string }> {
  const chunk = state.doc.textBetween(from, to, MULTILINE_BLOCK_SEP)
  const lines = lineTextsWithOffsets(chunk)
  for (const { offset } of lines) {
    const lineStart = docPosAtChunkOffset(state.doc, from, to, offset, MULTILINE_BLOCK_SEP)
    if (!isIndentContextAllowed(state, lineStart, rules)) return false
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
          if (!this.options.enabled) return false

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

          const linesOrFalse = multilineLinesIfAllowed(state, selection.from, selection.to, rules)
          if (linesOrFalse === false) return false
          const lines = linesOrFalse

          if (dispatch) {
            const positions = lines.map(({ offset }) =>
              docPosAtChunkOffset(
                state.doc,
                selection.from,
                selection.to,
                offset,
                MULTILINE_BLOCK_SEP
              )
            )
            positions.sort((a, b) => b - a)
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
          if (!this.options.enabled) return false

          const { selection } = state
          const { indentChars } = this.options
          const rules = this.options.allowedIndentContexts

          if (selection.empty) {
            if (!isCaretContextAllowed(state, rules)) return false
            const $cursor = (selection as TextSelection).$cursor
            if (!$cursor) return false

            const cursorPos = $cursor.pos
            const lineStart = state.doc.resolve(cursorPos).start()
            const textBeforeCursor = state.doc.textBetween(lineStart, cursorPos)
            const isAtLineStart = cursorPos === lineStart

            const removeTrailing =
              textBeforeCursor.length >= indentChars.length &&
              textBeforeCursor.endsWith(indentChars)
            const removeLeading =
              isAtLineStart &&
              textBeforeCursor.length >= indentChars.length &&
              textBeforeCursor.startsWith(indentChars)

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

          const linesOrFalse = multilineLinesIfAllowed(state, selection.from, selection.to, rules)
          if (linesOrFalse === false) return false
          const lines = linesOrFalse

          const canOutdentAnyLine = lines.some(({ text }) => text.startsWith(indentChars))
          if (!canOutdentAnyLine) {
            return false
          }

          if (dispatch) {
            const toDelete: number[] = []
            for (const { offset, text } of lines) {
              if (!text.startsWith(indentChars)) continue
              toDelete.push(
                docPosAtChunkOffset(
                  state.doc,
                  selection.from,
                  selection.to,
                  offset,
                  MULTILINE_BLOCK_SEP
                )
              )
            }
            toDelete.sort((a, b) => b - a)
            for (const p of toDelete) {
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
