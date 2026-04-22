// Interactions barrel — single composition point for everything the
// extension binds into ProseMirror's lifecycle (input rules + paste
// rules + plugins). All rules and plugins share one `LinkContext`
// (so one URL Decisions instance, one options view).

import type { InputRule, PasteRule } from '@tiptap/core'
import type { Plugin } from '@tiptap/pm/state'

import { createAutolinkInteraction } from './autolink'
import { createClickHandlerInteraction } from './clickHandler'
import { createMarkdownLinkInputRule } from './inputRule'
import { createPasteHandlerInteraction } from './pasteHandler'
import { createLinkifyPasteRule } from './pasteRule'
import type { LinkContext } from './types'

export { buildUrlDecisions, createLinkContext } from './createLinkContext'
export type { LinkContext } from './types'

export interface HyperlinkInteractions {
  inputRules: InputRule[]
  pasteRules: PasteRule[]
  plugins: Plugin[]
}

/** Build every interaction from a single context; plugin gating (`autolink`, `openOnClick`, `linkOnPaste`) lives here. */
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
