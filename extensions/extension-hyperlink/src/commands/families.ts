// UI commands stay separate from the pure schema commands per Tiptap
// canon: `setHyperlink` never opens dialogs. The Link-named migration
// aliases share the canonical references so policy changes flow through
// both names.

import { editHyperlinkCommand } from '../helpers/editHyperlink'
import { openCreateHyperlink } from '../openers/openCreateHyperlink'
import type { URLDecisions } from '../url-decisions'
import type { HyperlinkEngine } from './engine'
import type { HyperlinkRawCommands } from './surface'

type CanonicalFamily = Pick<
  HyperlinkRawCommands,
  'setHyperlink' | 'unsetHyperlink' | 'toggleHyperlink' | 'setLink' | 'unsetLink' | 'toggleLink'
>

export function canonicalCommands(engine: HyperlinkEngine): CanonicalFamily {
  return {
    setHyperlink: engine.set,
    unsetHyperlink: engine.unset,
    toggleHyperlink: engine.toggle,
    setLink: engine.set,
    unsetLink: engine.unset,
    toggleLink: engine.toggle
  }
}

export interface EditCommandsDeps {
  markName: string
  urls: URLDecisions
  validate?: (url: string) => boolean
}

type EditFamily = Pick<
  HyperlinkRawCommands,
  'editHyperlink' | 'editHyperlinkText' | 'editHyperlinkHref'
>

export function editCommands(deps: EditCommandsDeps): EditFamily {
  const base = { markName: deps.markName, urls: deps.urls, validate: deps.validate }
  return {
    editHyperlink: (attrs) => editHyperlinkCommand({ ...attrs, ...base })(),
    editHyperlinkText: (newText) => editHyperlinkCommand({ newText, ...base })(),
    editHyperlinkHref: (newURL) => editHyperlinkCommand({ newURL, ...base })()
  }
}

type UIFamily = Pick<HyperlinkRawCommands, 'openCreateHyperlinkPopover'>

export function uiCommands(): UIFamily {
  return {
    openCreateHyperlinkPopover:
      (attributes) =>
      ({ editor }) =>
        openCreateHyperlink(editor, attributes ?? {})
  }
}
