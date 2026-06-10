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
 * Map a character offset in `doc.textBetween(from, to, blockSeparator)` output to the document
 * position where that character begins. Binary search over the monotonic `textBetween(from, p).length`;
 * each probe re-measures from `from` because per-position slices don't compose across blocks.
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
  let lo = from
  let hi = to
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (doc.textBetween(from, mid, blockSeparator).length >= chunkOffset) hi = mid
    else lo = mid + 1
  }
  return lo
}

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
   * Full `(textblock, parent)` type-name allowlist for literal indent/outdent — `configure()` replaces
   * the whole list (no merge). `[]` disables literal indent; Tab still sinks lists and moves table cells.
   * @default `paragraph` under `doc`, and `paragraph` under `blockquote`
   */
  allowedIndentContexts: IndentContextRule[]
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

/**
 * Selections can begin mid-line or on a block boundary (`AllSelection` is `from` 0 at depth 0);
 * walk to the innermost textblock and return its content start so multiline ops always target
 * the line start. Returns `null` when no textblock exists at or after `pos`.
 */
function clampToTextblockStart(doc: Node, pos: number): number | null {
  let p = pos
  for (;;) {
    const $p = doc.resolve(p)
    for (let d = $p.depth; d > 0; d--) {
      if ($p.node(d).isTextblock) return $p.start(d)
    }
    const node = doc.nodeAt(p)
    if (!node) return null
    p += node.isLeaf ? node.nodeSize : 1
  }
}

/** Outdent deletes by position, not by measured chars: hop zero-width leaves (e.g. hardBreak). */
function skipZeroWidthLeaves(doc: Node, pos: number): number {
  let p = pos
  for (let node = doc.nodeAt(p); node && node.isLeaf && !node.isText; node = doc.nodeAt(p)) {
    p += node.nodeSize
  }
  return p
}

/**
 * One `textBetween` + parse; resolves each line's document position once (reused by the dispatch
 * loops). Line 1 is clamped to its textblock start (the selection may begin mid-line) and each
 * line's text is re-measured to its block end so leading-indent checks see the full line even
 * when the selection truncates it. Returns `false` if any line starts in a disallowed context.
 */
function multilineLinesIfAllowed(
  state: EditorState,
  from: number,
  to: number,
  rules: IndentContextRule[]
): false | IndentLine[] {
  const chunk = state.doc.textBetween(from, to, MULTILINE_BLOCK_SEP)
  const lines: IndentLine[] = []
  for (const { offset } of lineTextsWithOffsets(chunk)) {
    const rawPos = docPosAtChunkOffset(state.doc, from, to, offset, MULTILINE_BLOCK_SEP)
    const pos = lines.length === 0 ? clampToTextblockStart(state.doc, rawPos) : rawPos
    if (pos === null || !isIndentContextAllowed(state, pos, rules)) return false
    const $pos = state.doc.resolve(pos)
    lines.push({ text: state.doc.textBetween(pos, $pos.end()), pos })
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
          if (!this.options.enabled) return false

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

          const linesOrFalse = multilineLinesIfAllowed(state, selection.from, selection.to, rules)
          if (linesOrFalse === false) return false
          const lines = linesOrFalse

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
