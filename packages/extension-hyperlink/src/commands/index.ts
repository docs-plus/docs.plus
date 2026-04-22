// Hyperlink command façade — composes canonical / edit / UI families
// over a shared engine + URL Decisions pipeline. The `satisfies` clause
// in `buildHyperlinkCommands` pins the runtime shape against
// `HyperlinkPublicCommands` (surface.ts) so adding a public command
// without implementing it is a compile error.

import type { HyperlinkOptions } from '../hyperlink'
import type { URLDecisions } from '../url-decisions'
import { canonicalCommands } from './canonical'
import { editCommands } from './edit'
import { createHyperlinkEngine } from './engine'
import type { HyperlinkRawCommands } from './surface'
import { uiCommands } from './ui'

export { createHyperlinkEngine, type HyperlinkEngine, type HyperlinkEngineDeps } from './engine'
export type {
  EditHyperlinkAttributes,
  HyperlinkPublicCommands,
  HyperlinkRawCommands,
  SetHyperlinkAttributes
} from './surface'

export interface BuildHyperlinkCommandsCtx {
  markName: string
  options: HyperlinkOptions
  urls: URLDecisions
}

/** Compose every command family into the Tiptap-shaped command map. */
export function buildHyperlinkCommands(ctx: BuildHyperlinkCommandsCtx): HyperlinkRawCommands {
  const engine = createHyperlinkEngine({ markName: ctx.markName, urls: ctx.urls })
  return {
    ...canonicalCommands(engine),
    ...editCommands({ markName: ctx.markName, urls: ctx.urls, validate: ctx.options.validate }),
    ...uiCommands({ options: ctx.options, extensionName: ctx.markName })
  } satisfies HyperlinkRawCommands
}
