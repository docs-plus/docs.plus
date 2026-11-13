import { findChildrenInRange, getMarkRange, getMarksBetween, type NodeWithPos } from '@tiptap/core'
import { isHistoryTransaction } from '@tiptap/pm/history'
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { ReplaceStep } from '@tiptap/pm/transform'

import { PREVENT_AUTOLINK_META } from '../constants'
import { changedRanges } from './changedRanges'
import { isRemoteSync, ySyncOrigin } from './remoteSync'
import type { LinkContext } from './types'

const TRAILING_WHITESPACE_RE = /\s$/
const LAST_WHITESPACE_RE = /\s\S*$/
// `\S+` (not split on `' '`) so NBSP / narrow NBSP / tab / ideographic space
// also fire the autolink boundary that the user expects.
const WORD_RE = /\S+/g
const SPACE_RE = /\s/
const IMAGE_MARKDOWN_CONTEXT_CHARS = 15

// Scans back from the end, so a 250k-character block costs only its last words, not one match per word.
const lastWordEnd = (text: string): number => {
  let end = text.length
  while (end > 0 && SPACE_RE.test(text[end - 1])) end--
  return end
}
// Words that end at or after `from`, a text offset; a word that `from` cuts into counts whole.
function wordsEndingFrom(text: string, from: number): RegExpExecArray[] {
  let start = Math.max(0, Math.min(from, text.length))
  while (start > 0 && !SPACE_RE.test(text[start - 1])) start--
  return [...text.slice(start).matchAll(WORD_RE)].map((word) => {
    word.index += start
    return word
  })
}

// Dictation, an IME phrase or a text replacement inserts many words in one typed transaction.
// prosemirror-view scrolls typed input; paste, drop, history, y-sync and mark steps are not typing.
function isTypedChunk(tr: Transaction, state: EditorState): boolean {
  const uiEvent = tr.getMeta('uiEvent')
  return (
    uiEvent !== 'paste' &&
    uiEvent !== 'drop' &&
    tr.steps.every((step) => step instanceof ReplaceStep) &&
    tr.scrolledIntoView &&
    !isHistoryTransaction(tr) &&
    ySyncOrigin(tr, state) === null
  )
}

export function createAutolinkInteraction(ctx: LinkContext): Plugin {
  const { urls, type } = ctx
  return new Plugin({
    key: new PluginKey('hyperlinkAutolink'),
    appendTransaction: (transactions, oldState, newState) => {
      const docChanges =
        transactions.some((transaction) => transaction.docChanged) && !oldState.doc.eq(newState.doc)
      // Each client autolinks only what its own user typed (#771).
      const skip =
        !docChanges ||
        transactions.some((transaction) => transaction.getMeta(PREVENT_AUTOLINK_META)) ||
        isRemoteSync(transactions, newState)
      if (skip) return

      const { tr } = newState
      const typedChunk = transactions.every((transaction) => isTypedChunk(transaction, newState))
      // Tiptap's combineTransactionSteps + getChangedRanges cost O(steps²) on a big paste or Bold.
      const { changes, map } = changedRanges(transactions)
      // `?? null` keeps the plugin working in schemas without a `code` mark.
      const codeMarkType = newState.schema.marks.code ?? null

      for (const { oldRange, newRange } of changes) {
        for (const oldMark of getMarksBetween(oldRange.from, oldRange.to, oldState.doc).filter(
          (item) => item.mark.type === type
        )) {
          // Other marks split one link into several text nodes, so check the whole link.
          const oldLink =
            getMarkRange(oldState.doc.resolve(oldMark.from), type, oldMark.mark.attrs) ?? oldMark
          const newFrom = map(oldLink.from)
          const newTo = map(oldLink.to)
          const newMarks = getMarksBetween(newFrom, newTo, newState.doc).filter(
            (item) => item.mark.type === type
          )

          if (!newMarks.length) continue

          const oldLinkText = oldState.doc.textBetween(oldLink.from, oldLink.to, undefined, ' ')
          // A mark-only change (bold, code) keeps the text, so leave the link alone.
          // No block separator: Enter inside a link keeps both halves linked, as upstream does (#778).
          if (newState.doc.textBetween(newFrom, newTo, undefined, ' ') === oldLinkText) continue

          const first = newMarks[0]
          const newMark =
            getMarkRange(newState.doc.resolve(first.from), type, first.mark.attrs) ?? first
          const newLinkText = newState.doc.textBetween(newMark.from, newMark.to, undefined, ' ')
          // `detect` (no gating) so a tightened `isAllowedUri` can't retroactively strip valid marks.
          const wasLink = urls.detect(oldLinkText)
          const isLink = urls.detect(newLinkText)

          if (wasLink && !isLink) {
            tr.removeMark(newMark.from, newMark.to, type)
          }
        }

        const nodesInChangedRanges = findChildrenInRange(
          newState.doc,
          newRange,
          (node) => node.isTextblock
        )

        let textBlock: NodeWithPos | undefined
        let textBeforeWhitespace: string | undefined
        // Set for a typed chunk: a finished word that ends at or after it is a candidate too.
        let chunkFrom: number | undefined

        if (nodesInChangedRanges.length > 1) {
          textBlock = nodesInChangedRanges[0]
          textBeforeWhitespace = newState.doc.textBetween(
            textBlock.pos,
            textBlock.pos + textBlock.node.nodeSize,
            undefined,
            ' '
          )
        } else if (nodesInChangedRanges.length) {
          const inserted = newState.doc.textBetween(newRange.from, newRange.to, ' ', ' ')
          let end = TRAILING_WHITESPACE_RE.test(inserted) ? newRange.to : -1
          // Stop after the last whitespace: the word after it may still be typed.
          if (end === -1 && typedChunk) {
            const lastWhitespace = inserted.search(LAST_WHITESPACE_RE)
            if (lastWhitespace !== -1) end = newRange.from + lastWhitespace + 1
          }
          if (end !== -1) {
            textBlock = nodesInChangedRanges[0]
            textBeforeWhitespace = newState.doc.textBetween(textBlock.pos, end, undefined, ' ')
            if (typedChunk) chunkFrom = newRange.from
          }
        }

        if (!textBlock || !textBeforeWhitespace) continue

        const textStart = textBlock.pos + 1
        // The last word is always a candidate, as before #780: a second space still links it.
        const lastEnd = lastWordEnd(textBeforeWhitespace)
        const candidates = wordsEndingFrom(
          textBeforeWhitespace,
          chunkFrom === undefined ? lastEnd : Math.min(chunkFrom - textStart, lastEnd)
        )

        // The image-markdown and code-mark filters below are document-context, not URL gates — they stay local.
        candidates
          .flatMap((word) =>
            urls.forWrite({ kind: 'text', text: word[0] }).map((result) => ({
              href: result.href,
              from: textStart + word.index + result.start,
              to: textStart + word.index + result.end
            }))
          )
          .filter(({ from }) => {
            const contextStart = Math.max(0, from - IMAGE_MARKDOWN_CONTEXT_CHARS)
            const beforeLink = newState.doc.textBetween(contextStart, from, ' ', ' ')
            const isInsideImageMarkdown = beforeLink.includes('![') && beforeLink.endsWith('](')
            return !isInsideImageMarkdown
          })
          // Skip ranges already inside an inline `code` mark — matches `@tiptap/extension-link` v3.
          .filter(({ from }) => {
            if (!codeMarkType) return true
            const node = newState.doc.nodeAt(from)
            return !node?.marks.some((m) => m.type === codeMarkType)
          })
          // A link already there may point somewhere else; never rewrite it. Matches upstream.
          .filter(({ from, to }) => !newState.doc.rangeHasMark(from, to, type))
          .forEach(({ from, to, href }) => {
            tr.addMark(from, to, type.create({ href }))
          })
      }

      if (!tr.steps.length) {
        return
      }

      return tr
    }
  })
}
