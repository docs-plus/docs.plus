// Autolink interaction — bare URL text becomes a hyperlink mark
// when the user types whitespace; marks whose text was mutated past
// recognition get stripped.

import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  getMarksBetween,
  type NodeWithPos
} from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { PREVENT_AUTOLINK_META } from '../constants'
import type { LinkContext } from './types'

const TRAILING_WHITESPACE_RE = /\s$/
const IMAGE_MARKDOWN_CONTEXT_CHARS = 15

// `\s+` (not `' '`) is required so NBSP / narrow NBSP / tab / ideographic-space
// also fire the autolink boundary that the user expects.
const tokenizeWords = (text: string): string[] => text.split(/\s+/).filter((s) => s !== '')

export function createAutolinkInteraction(ctx: LinkContext): Plugin {
  const { urls, type } = ctx
  return new Plugin({
    key: new PluginKey('hyperlinkAutolink'),
    appendTransaction: (transactions, oldState, newState) => {
      const docChanges =
        transactions.some((transaction) => transaction.docChanged) && !oldState.doc.eq(newState.doc)
      const shouldSkipAutolink = transactions.some((transaction) =>
        transaction.getMeta(PREVENT_AUTOLINK_META)
      )

      if (!docChanges || shouldSkipAutolink) {
        return
      }

      const { tr } = newState
      const transform = combineTransactionSteps(oldState.doc, [...transactions])
      const { mapping } = transform
      const changes = getChangedRanges(transform)
      // `?? null` keeps the plugin working in schemas without a `code` mark.
      const codeMarkType = newState.schema.marks.code ?? null

      for (const { oldRange, newRange } of changes) {
        for (const oldMark of getMarksBetween(oldRange.from, oldRange.to, oldState.doc).filter(
          (item) => item.mark.type === type
        )) {
          const newFrom = mapping.map(oldMark.from)
          const newTo = mapping.map(oldMark.to)
          const newMarks = getMarksBetween(newFrom, newTo, newState.doc).filter(
            (item) => item.mark.type === type
          )

          if (!newMarks.length) continue

          const newMark = newMarks[0]
          const oldLinkText = oldState.doc.textBetween(oldMark.from, oldMark.to, undefined, ' ')
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

        if (nodesInChangedRanges.length > 1) {
          textBlock = nodesInChangedRanges[0]
          textBeforeWhitespace = newState.doc.textBetween(
            textBlock.pos,
            textBlock.pos + textBlock.node.nodeSize,
            undefined,
            ' '
          )
        } else if (
          nodesInChangedRanges.length &&
          TRAILING_WHITESPACE_RE.test(
            newState.doc.textBetween(newRange.from, newRange.to, ' ', ' ')
          )
        ) {
          textBlock = nodesInChangedRanges[0]
          textBeforeWhitespace = newState.doc.textBetween(
            textBlock.pos,
            newRange.to,
            undefined,
            ' '
          )
        }

        if (!textBlock || !textBeforeWhitespace) continue

        const wordsBeforeWhitespace = tokenizeWords(textBeforeWhitespace)
        if (wordsBeforeWhitespace.length <= 0) continue

        const lastWordBeforeSpace = wordsBeforeWhitespace[wordsBeforeWhitespace.length - 1]
        if (!lastWordBeforeSpace) continue

        const lastWordAndBlockOffset =
          textBlock.pos + textBeforeWhitespace.lastIndexOf(lastWordBeforeSpace)

        // The image-markdown and code-mark filters below are document-context, not URL gates — they stay local.
        urls
          .forWrite({ kind: 'text', text: lastWordBeforeSpace })
          .map((result) => ({
            href: result.href,
            from: lastWordAndBlockOffset + result.start + 1,
            to: lastWordAndBlockOffset + result.end + 1
          }))
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
