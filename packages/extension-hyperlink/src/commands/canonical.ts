// Canonical commands + `@tiptap/extension-link` migration aliases.
// Both names delegate directly to the same engine methods so any
// future policy change flows through both surfaces automatically.

import type { HyperlinkEngine } from './engine'
import type { HyperlinkRawCommands } from './surface'

type CanonicalCommands = Pick<
  HyperlinkRawCommands,
  'setHyperlink' | 'unsetHyperlink' | 'toggleHyperlink' | 'setLink' | 'unsetLink' | 'toggleLink'
>

export function canonicalCommands(engine: HyperlinkEngine): CanonicalCommands {
  return {
    setHyperlink: engine.set,
    unsetHyperlink: engine.unset,
    toggleHyperlink: engine.toggle,
    setLink: engine.set,
    unsetLink: engine.unset,
    toggleLink: engine.toggle
  }
}
