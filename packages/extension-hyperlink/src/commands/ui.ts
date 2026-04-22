// UI commands — side-effecting popover-mounting commands. Kept
// separate from the pure schema commands per Tiptap canon: a clean
// `setHyperlink` does not open dialogs.

import { openCreateHyperlinkPopover as openCreateHyperlinkPopoverHelper } from '../helpers/openCreateHyperlinkPopover'
import type { HyperlinkOptions } from '../hyperlink'
import type { HyperlinkRawCommands } from './surface'

export interface UICommandsDeps {
  options: HyperlinkOptions
  /** Mark name (= extension name); used by the popover wiring. */
  extensionName: string
}

type UICommands = Pick<HyperlinkRawCommands, 'openCreateHyperlinkPopover'>

export function uiCommands(deps: UICommandsDeps): UICommands {
  return {
    openCreateHyperlinkPopover:
      (attributes) =>
      ({ editor }) =>
        openCreateHyperlinkPopoverHelper({
          editor,
          options: deps.options,
          extensionName: deps.extensionName,
          attributes: attributes ?? {}
        })
  }
}
