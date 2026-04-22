// Edit-family commands. Wraps `editHyperlinkCommand` with one
// shared deps bag so the markName / urls / validate wiring lives
// in exactly one place.

import { editHyperlinkCommand } from '../helpers/editHyperlink'
import type { URLDecisions } from '../url-decisions'
import type { HyperlinkRawCommands } from './surface'

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
