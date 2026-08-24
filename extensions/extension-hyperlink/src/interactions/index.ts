import type { InputRule, PasteRule } from '@tiptap/core'
import type { Plugin } from '@tiptap/pm/state'

import { createAutolinkInteraction } from './autolink'
import { createClickHandlerInteraction } from './clickHandler'
import { createMarkdownLinkInputRule } from './inputRule'
import { createPasteHandlerInteraction } from './pasteHandler'
import { createLinkifyPasteRule } from './pasteRule'
import type { LinkContext } from './types'

export { createLinkContext } from './createLinkContext'
export type { LinkContext } from './types'

export interface HyperlinkInteractions {
  inputRules: InputRule[]
  pasteRules: PasteRule[]
  plugins: Plugin[]
}

export function createInteractions(ctx: LinkContext): HyperlinkInteractions {
  const plugins: Plugin[] = []
  if (ctx.options.autolink) plugins.push(createAutolinkInteraction(ctx))
  if (ctx.options.openOnClick) plugins.push(createClickHandlerInteraction(ctx))
  if (ctx.options.linkOnPaste) plugins.push(createPasteHandlerInteraction(ctx))

  return {
    inputRules: [createMarkdownLinkInputRule(ctx)],
    pasteRules: [createLinkifyPasteRule(ctx)],
    plugins
  }
}
