import type { Editor } from '@tiptap/core'

import { BASE_ACTIONS, NODE_ACTIONS } from './actions'
import type { MediaActionList } from './types'
import { getKitStorage } from './types'

/** kit defaults (sorted by `order`) → host `mediaActions` override (whose array order is final). */
export function resolveMediaActions(editor: Editor, nodeType: string): MediaActionList {
  const defaults: MediaActionList = [...BASE_ACTIONS, ...(NODE_ACTIONS[nodeType] ?? [])].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  )
  const resolver = getKitStorage(editor).mediaActions
  return resolver ? resolver(defaults, { nodeType }) : defaults
}
