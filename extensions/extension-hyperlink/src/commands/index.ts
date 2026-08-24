// `satisfies HyperlinkRawCommands` so a new public command without an impl is a compile error.

import type { HyperlinkOptions } from '../hyperlink'
import type { URLDecisions } from '../url-decisions'
import { createHyperlinkEngine } from './engine'
import { canonicalCommands, editCommands, uiCommands } from './families'
import type { HyperlinkRawCommands } from './surface'

export type {
  EditHyperlinkAttributes,
  HyperlinkPublicCommands,
  SetHyperlinkAttributes
} from './surface'

export interface BuildHyperlinkCommandsCtx {
  markName: string
  options: HyperlinkOptions
  urls: URLDecisions
}

export function buildHyperlinkCommands(ctx: BuildHyperlinkCommandsCtx): HyperlinkRawCommands {
  const engine = createHyperlinkEngine({ markName: ctx.markName, urls: ctx.urls })
  return {
    ...canonicalCommands(engine),
    ...editCommands({ markName: ctx.markName, urls: ctx.urls, validate: ctx.options.validate }),
    ...uiCommands()
  } satisfies HyperlinkRawCommands
}
