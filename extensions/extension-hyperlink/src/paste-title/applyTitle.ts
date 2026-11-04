import { getMarkRange, type Range } from '@tiptap/core'

import type { LinkContext } from '../interactions/types'
import { cleanTitle } from './cleanTitle'
import { dispatchSwap, oneUrl } from './pasteTitle'

/**
 * The "Use page title" action for one link, or `undefined` when it does not apply: the editor
 * is read-only, the link text is not its own URL, or the title fails the paste-title rules.
 * The action checks the link again when it runs, and answers whether it changed the text.
 */
export function applyTitle(
  ctx: LinkContext,
  link: HTMLAnchorElement,
  href: string,
  title: string | undefined
): (() => boolean) | undefined {
  if (!title || !swapFor(ctx, link, href, title)) return undefined
  return () => {
    const swap = swapFor(ctx, link, href, title)
    if (!swap) return false
    // The paste swap's own transaction, so y-undo and prosemirror-history see one step.
    dispatchSwap(ctx.editor, swap.range, swap.title)
    return true
  }
}

// Read again on click: a co-editor may have changed the link since the card opened.
function swapFor(
  ctx: LinkContext,
  link: HTMLAnchorElement,
  href: string,
  title: string
): { range: Range; title: string } | null {
  if (!ctx.editor.isEditable) return null
  const found = rawUrlLink(ctx, link, href)
  const clean = found && cleanTitle(title, { text: found.text, href })
  return found && clean ? { range: found.range, title: clean } : null
}

/** The link's range and text, when its whole text is a URL that stores this same href. */
function rawUrlLink(
  ctx: LinkContext,
  link: HTMLAnchorElement,
  href: string
): { range: Range; text: string } | null {
  const { doc } = ctx.editor.state
  let pos: number
  try {
    pos = link.isConnected ? ctx.editor.view.posAtDOM(link, 0) : -1
  } catch {
    return null
  }
  if (pos < 0 || pos > doc.content.size) return null
  const range = getMarkRange(doc.resolve(pos), ctx.type, { href })
  if (!range) return null
  const text = doc.textBetween(range.from, range.to, '')
  const match = oneUrl(text)
  const [decision] = match ? ctx.urls.forWrite({ kind: 'match', match }) : []
  return decision?.href === href ? { range, text } : null
}
