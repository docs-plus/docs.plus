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
import { validateURL } from '../utils/validateURL'

type AutoHyperlinkOptions = {
  type: MarkType
  validate?: (url: string) => boolean
}

/**
 * Simple regex to catch special URL schemes that linkifyjs misses
 * Matches: scheme://... or scheme:content (no spaces)
 */
const SPECIAL_SCHEME_REGEX = /\b[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+/g

/**
 * Enhanced find function that combines linkifyjs with special scheme detection
 */
const findLinks = (text: string) => {
  const links = []

  // Get standard links from linkifyjs
  const standardLinks = find(text).filter((link) => link.isLink)
  links.push(...standardLinks)

  // Find special scheme URLs that linkifyjs missed
  const specialMatches = text.matchAll(SPECIAL_SCHEME_REGEX)
  for (const match of specialMatches) {
    const url = match[0]
    const start = match.index!
    const end = start + url.length

    // Skip if already covered by linkifyjs
    const alreadyCovered = standardLinks.some((link) => start >= link.start && end <= link.end)

    if (!alreadyCovered && validateURL(url)) {
      links.push({
        href: url,
        value: url,
        start,
        end,
        isLink: true
      })
    }
  }

  // Clean up trailing punctuation from all detected links
  return links.map((link) => {
    const originalValue = link.value || link.href
    // Remove common trailing punctuation that's likely not part of the URL
    const cleanValue = originalValue.replace(/[.,;:!?)\]}]+$/, '')
    const lengthDiff = originalValue.length - cleanValue.length

    return {
      ...link,
      href: cleanValue,
      value: cleanValue,
      end: link.end - lengthDiff
    }
  })
}

/**
 * Enhanced test function that checks both linkifyjs and special schemes
 */
const testUrl = (text: string): boolean => {
  if (test(text)) return true
  return SPECIAL_SCHEME_REGEX.test(text) && validateURL(text)
}

export default function AutoHyperlinkPlugin(options: AutoHyperlinkOptions): Plugin {
  return new Plugin({
    key: new PluginKey('HyperLinkAutolink'),
    appendTransaction: (transactions, oldState, newState) => {
      const docChanges =
        transactions.some((transaction) => transaction.docChanged) && !oldState.doc.eq(newState.doc)
      const preventAutoHyperlink = transactions.some((transaction) =>
        transaction.getMeta('preventAutoHyperlink')
      )

      if (!docChanges || preventAutoHyperlink) {
        return
      }

      const { tr } = newState
      const transform = combineTransactionSteps(oldState.doc, [...transactions])
      const { mapping } = transform
      const changes = getChangedRanges(transform)

      changes.forEach(({ oldRange, newRange }) => {
        // Check if we need to remove links
        getMarksBetween(oldRange.from, oldRange.to, oldState.doc)
          .filter((item) => item.mark.type === options.type)
          .forEach((oldMark) => {
            const newFrom = mapping.map(oldMark.from)
            const newTo = mapping.map(oldMark.to)
            const newMarks = getMarksBetween(newFrom, newTo, newState.doc).filter(
              (item) => item.mark.type === options.type
            )

            if (!newMarks.length) {
              return
            }

            const newMark = newMarks[0]
            const oldLinkText = oldState.doc.textBetween(oldMark.from, oldMark.to, undefined, ' ')
            const newLinkText = newState.doc.textBetween(newMark.from, newMark.to, undefined, ' ')
            const wasLink = testUrl(oldLinkText)
            const isLink = testUrl(newLinkText)

            // Remove link if it's no longer valid
            if (wasLink && !isLink) {
              tr.removeMark(newMark.from, newMark.to, options.type)
            }
          })

        // Add new links
        const nodesInChangedRanges = findChildrenInRange(
          newState.doc,
          newRange,
          (node) => node.isTextblock
        )

        let textBlock: NodeWithPos | undefined
        let textBeforeWhitespace: string | undefined

        if (nodesInChangedRanges.length > 1) {
          // Grab the first node within the changed ranges (ex. the first of two paragraphs when hitting enter)
          textBlock = nodesInChangedRanges[0]
          textBeforeWhitespace = newState.doc.textBetween(
            textBlock.pos,
            textBlock.pos + textBlock.node.nodeSize,
            undefined,
            ' '
          )
        } else if (
          nodesInChangedRanges.length &&
          // We want to make sure to include the block seperator argument to treat hard breaks like spaces
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

        if (textBlock && textBeforeWhitespace) {
          const wordsBeforeWhitespace = textBeforeWhitespace.split(' ').filter((s) => s !== '')

          if (wordsBeforeWhitespace.length <= 0) {
            return false
          }

          const lastWordBeforeSpace = wordsBeforeWhitespace[wordsBeforeWhitespace.length - 1]
          const lastWordAndBlockOffset =
            textBlock.pos + textBeforeWhitespace.lastIndexOf(lastWordBeforeSpace)

          if (!lastWordBeforeSpace) {
            return false
          }

          findLinks(lastWordBeforeSpace)
            .filter((link) => link.isLink)
            .filter((link) => {
              if (options.validate) {
                return options.validate(link.value)
              }
              return true
            })
            // calculate link position
            .map((link) => ({
              ...link,
              from: lastWordAndBlockOffset + link.start + 1,
              to: lastWordAndBlockOffset + link.end + 1
            }))
            // Filter out URLs that are part of markdown IMAGE syntax ![text](url)
            .filter((link) => {
              // Get context before the link to check for image markdown patterns
              const contextStart = Math.max(0, link.from - 15)
              const beforeLink = newState.doc.textBetween(contextStart, link.from, ' ', ' ')

              // Don't auto-link if URL is preceded by !]( which indicates image markdown syntax
              const isInsideImageMarkdown = beforeLink.includes('![') && beforeLink.endsWith('](')

              return !isInsideImageMarkdown
            })
            // add link mark
            .forEach((link) => {
              tr.addMark(
                link.from,
                link.to,
                options.type.create({
                  href: link.href
                })
              )
            })
        }
      })

      if (!tr.steps.length) {
        return
      }

      return tr
    }
  })
}
