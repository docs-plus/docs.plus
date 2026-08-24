import type { Editor } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'

import type { HyperlinkOptions, LinkProtocolOptions } from '../hyperlink'
import { composeGate, createURLDecisions, type URLDecisions } from '../url-decisions'
import type { LinkContext } from './types'

export interface CreateLinkContextArgs {
  editor: Editor
  type: MarkType
  options: HyperlinkOptions
}

/** Build the URL Decisions instance for a hyperlink extension. Prefer `createLinkContext` in production. */
export function buildUrlDecisions(options: HyperlinkOptions): URLDecisions {
  return createURLDecisions({
    defaultProtocol: options.defaultProtocol,
    gate: composeGate<LinkProtocolOptions | string>({
      isAllowedUri: options.isAllowedUri,
      protocols: options.protocols,
      defaultProtocol: options.defaultProtocol
    }),
    validate: options.validate,
    shouldAutoLink: options.shouldAutoLink
  })
}

export function createLinkContext({ editor, type, options }: CreateLinkContextArgs): LinkContext {
  return {
    type,
    editor,
    urls: buildUrlDecisions(options),
    options,
    validate: options.validate,
    previewPopover: options.popovers.previewHyperlink ?? null
  }
}
