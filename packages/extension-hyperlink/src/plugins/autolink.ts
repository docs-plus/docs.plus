import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  getMarksBetween,
  NodeWithPos
} from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { find, test } from 'linkifyjs'

import { normalizeLinkifyHref } from '../utils/normalizeHref'
import { validateURL } from '../utils/validateURL'

type AutolinkOptions = {
  type: MarkType
  validate?: (url: string) => boolean
}

const SPECIAL_SCHEME_REGEX_GLOBAL = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/g
const SPECIAL_SCHEME_REGEX = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/
const IMAGE_MARKDOWN_CONTEXT_CHARS = 15

const TRAILING_PUNCT_RE = /[.,;:!?)\]}]+$/

/**
 * Trim trailing punctuation from the match range so "Visit google.com."
 * autolinks `google.com`, not `google.com.`. `href` and `value` only
 * diverge for linkifyjs email / custom-scheme matches (`mailto:…` vs raw
 * email text) — there the scheme prefix means `href` won't share the
 * trailing punctuation, so we leave it alone.
 */
const stripTrailingPunct = <T extends { value: string; href: string; end: number }>(link: T): T => {
  const tail = link.value.match(TRAILING_PUNCT_RE)
  if (!tail) return link
  const len = tail[0].length
  return {
    ...link,
    value: link.value.slice(0, -len),
    href: link.href.endsWith(tail[0]) ? link.href.slice(0, -len) : link.href,
    end: link.end - len
  }
}

const findLinks = (text: string) => {
  const links = []

  const standardLinks = find(text).filter((link) => link.isLink)
  links.push(...standardLinks)

  // Custom special-scheme entries (e.g. `whatsapp://send`) that linkifyjs
  // doesn't recognize. Tagged `type: 'url'` so `normalizeLinkifyHref`
  // routes them through the same code path as real URL matches (which is
  // a no-op when a scheme is already present).
  for (const match of text.matchAll(SPECIAL_SCHEME_REGEX_GLOBAL)) {
    const url = match[0]
    const start = match.index!
    const end = start + url.length
    const alreadyCovered = standardLinks.some((link) => start >= link.start && end <= link.end)
    if (!alreadyCovered && validateURL(url)) {
      links.push({ type: 'url', href: url, value: url, start, end, isLink: true })
    }
  }

  return links.map(stripTrailingPunct)
}

const testUrl = (text: string): boolean => {
  if (test(text)) return true
  return SPECIAL_SCHEME_REGEX.test(text) && validateURL(text)
}

export default function autolinkPlugin(options: AutolinkOptions): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkAutolink'),
    appendTransaction: (transactions, oldState, newState) => {
      const docChanges =
        transactions.some((transaction) => transaction.docChanged) && !oldState.doc.eq(newState.doc)
      const preventAutolink = transactions.some((transaction) =>
        transaction.getMeta('preventAutolink')
      )

      if (!docChanges || preventAutolink) {
        return
      }

      const { tr } = newState
      const transform = combineTransactionSteps(oldState.doc, [...transactions])
      const { mapping } = transform
      const changes = getChangedRanges(transform)

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
          newState.doc.textBetween(newRange.from, newRange.to, ' ', ' ').endsWith(' ')
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

        const wordsBeforeWhitespace = textBeforeWhitespace.split(' ').filter((s) => s !== '')
        if (wordsBeforeWhitespace.length <= 0) continue

        const lastWordBeforeSpace = wordsBeforeWhitespace[wordsBeforeWhitespace.length - 1]
        if (!lastWordBeforeSpace) continue

        const lastWordAndBlockOffset =
          textBlock.pos + textBeforeWhitespace.lastIndexOf(lastWordBeforeSpace)

        findLinks(lastWordBeforeSpace)
          .filter((link) => link.isLink)
          .filter((link) => {
            if (options.validate) {
              return options.validate(link.value)
            }
            return true
          })
          .map((link) => ({
            ...link,
            from: lastWordAndBlockOffset + link.start + 1,
            to: lastWordAndBlockOffset + link.end + 1
          }))
          .filter((link) => {
            const contextStart = Math.max(0, link.from - IMAGE_MARKDOWN_CONTEXT_CHARS)
            const beforeLink = newState.doc.textBetween(contextStart, link.from, ' ', ' ')
            const isInsideImageMarkdown = beforeLink.includes('![') && beforeLink.endsWith('](')
            return !isInsideImageMarkdown
          })
          .forEach((link) => {
            tr.addMark(
              link.from,
              link.to,
              options.type.create({ href: normalizeLinkifyHref(link) })
            )
          })
      }

      if (!tr.steps.length) {
        return
      }

      return tr
    }
  })
}
