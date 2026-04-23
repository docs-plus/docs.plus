// Three command families wired over the shared engine + URL Decisions
// pipeline:
//   • Canonical — pure schema commands plus `@tiptap/extension-link`
//     migration aliases (set/unset/toggle Link → Hyperlink, same
//     references so any future policy change flows through both names).
//   • Edit — `editHyperlink*` shorthands that share one deps bag so the
//     markName / urls / validate wiring lives in exactly one place.
//   • UI — side-effecting popover-mounting commands. Kept separate from
//     the pure schema commands per Tiptap canon: a clean `setHyperlink`
//     does not open dialogs.

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
