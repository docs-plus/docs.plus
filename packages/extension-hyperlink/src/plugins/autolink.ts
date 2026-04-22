import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  getMarksBetween,
  NodeWithPos
} from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { test } from 'linkifyjs'

import { PREVENT_AUTOLINK_META } from '../constants'
import { findLinks } from '../utils/findLinks'
import { DEFAULT_PROTOCOL, normalizeLinkifyHref } from '../utils/normalizeHref'
import { isBarePhone } from '../utils/phone'
import { isSafeHref, validateURL } from '../utils/validateURL'

type AutolinkOptions = {
  type: MarkType
  validate?: (url: string) => boolean
  /** Per-link veto that runs AFTER `validate`. Mirrors the extension option. */
  shouldAutoLink?: (uri: string) => boolean
  /** Composed XSS + `isAllowedUri` gate. Defaults to plain `isSafeHref`. */
  isAllowedUri?: (uri: string) => boolean
  /** Bare-domain promotion target for linkify URL matches. */
  defaultProtocol?: string
}

const SPECIAL_SCHEME_REGEX = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/
const TRAILING_WHITESPACE_RE = /\s$/
const IMAGE_MARKDOWN_CONTEXT_CHARS = 15

/**
 * Whitespace tokenizer for the "last word before whitespace" heuristic.
 * Plain `.split(' ')` only splits on U+0020 — NBSP (U+00A0), narrow
 * NBSP (U+202F), tabs, and ideographic spaces all roll through as
 * part of the previous token, so an autolink boundary on those
 * characters never fires. `\s+` covers every Unicode whitespace
 * character ProseMirror's serializer can emit.
 */
const tokenizeWords = (text: string): string[] => text.split(/\s+/).filter((s) => s !== '')

const testUrl = (text: string): boolean => {
  if (test(text)) return true
  if (SPECIAL_SCHEME_REGEX.test(text) && validateURL(text)) return true
  // Phone-shape check so the appendTransaction "removed link if the
  // edited text no longer looks like a link" branch fires when the
  // user backspaces a digit out of an autolinked phone.
  return isBarePhone(text).ok
}

export default function autolinkPlugin(options: AutolinkOptions): Plugin {
  const defaultProtocol = options.defaultProtocol ?? DEFAULT_PROTOCOL
  const isAllowed = options.isAllowedUri ?? isSafeHref
  // Looked up lazily inside appendTransaction so the plugin still
  // works in schemas that omit the `code` mark (e.g. plain-text editor).
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
      const codeMarkType = newState.schema.marks.code ?? null

      for (const { oldRange, newRange } of changes) {
        // Check if we need to remove links
        for (const oldMark of getMarksBetween(oldRange.from, oldRange.to, oldState.doc).filter(
          (item) => item.mark.type === options.type
        )) {
          const newFrom = mapping.map(oldMark.from)
          const newTo = mapping.map(oldMark.to)
          const newMarks = getMarksBetween(newFrom, newTo, newState.doc).filter(
            (item) => item.mark.type === options.type
          )

          if (!newMarks.length) continue

          const newMark = newMarks[0]
          const oldLinkText = oldState.doc.textBetween(oldMark.from, oldMark.to, undefined, ' ')
          const newLinkText = newState.doc.textBetween(newMark.from, newMark.to, undefined, ' ')
          const wasLink = testUrl(oldLinkText)
          const isLink = testUrl(newLinkText)

          if (wasLink && !isLink) {
            tr.removeMark(newMark.from, newMark.to, options.type)
          }
        }

        // Add new links
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

        findLinks(lastWordBeforeSpace)
          .filter((link) => link.isLink)
          .filter((link) => (options.validate ? options.validate(link.value) : true))
          // Resolve the canonical href once — `normalizeLinkifyHref` is
          // non-trivial (phone/email/scheme promotion) and was being
          // recomputed up to three times per candidate downstream.
          .map((link) => ({
            href: normalizeLinkifyHref(link, defaultProtocol),
            from: lastWordAndBlockOffset + link.start + 1,
            to: lastWordAndBlockOffset + link.end + 1
          }))
          .filter(({ href }) => isAllowed(href))
          .filter(({ href }) => (options.shouldAutoLink ? options.shouldAutoLink(href) : true))
          .filter(({ from }) => {
            const contextStart = Math.max(0, from - IMAGE_MARKDOWN_CONTEXT_CHARS)
            const beforeLink = newState.doc.textBetween(contextStart, from, ' ', ' ')
            const isInsideImageMarkdown = beforeLink.includes('![') && beforeLink.endsWith('](')
            return !isInsideImageMarkdown
          })
          // Skip ranges that already carry the inline `code` mark — a
          // URL inside `<code>` is content, not a navigation target.
          // Mirrors `@tiptap/extension-link` v3 (its rendered <a> as a
          // descendant of <code> would lose its semantics anyway).
          .filter(({ from }) => {
            if (!codeMarkType) return true
            const node = newState.doc.nodeAt(from)
            return !node?.marks.some((m) => m.type === codeMarkType)
          })
          .forEach(({ from, to, href }) => {
            tr.addMark(from, to, options.type.create({ href }))
          })
      }

      if (!tr.steps.length) {
        return
      }

      return tr
    }
  })
}
