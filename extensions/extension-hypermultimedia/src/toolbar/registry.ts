import type { Editor } from '@tiptap/core'

import { getKitStorage } from '../kitStorage'
import { BASE_ACTIONS, NODE_ACTION_RECIPES } from './actions'
import { composeMediaActions } from './compose'
import type { MediaActionList, MediaActionsResolver } from './types'

function computeMediaActions(
  nodeType: string,
  mediaActions: MediaActionsResolver | undefined
): MediaActionList {
  const recipe = NODE_ACTION_RECIPES[nodeType]
  const defaults = recipe ? recipe(composeMediaActions(BASE_ACTIONS)).result() : BASE_ACTIONS
  return mediaActions ? mediaActions(defaults, { nodeType }) : defaults
}

const actionsCache = new WeakMap<
  Editor,
  {
    doc: Editor['state']['doc']
    mediaActions: MediaActionsResolver | undefined
    byType: Map<string, MediaActionList>
  }
>()

/** Base bricks + per-node recipe (array order is final) → host `mediaActions` override. */
export function resolveMediaActions(editor: Editor, nodeType: string): MediaActionList {
  const doc = editor.state.doc
  const mediaActions = getKitStorage(editor).mediaActions
  let cache = actionsCache.get(editor)
  if (!cache || cache.doc !== doc || cache.mediaActions !== mediaActions) {
    cache = { doc, mediaActions, byType: new Map() }
    actionsCache.set(editor, cache)
  }
  const hit = cache.byType.get(nodeType)
  if (hit) return hit
  const actions = computeMediaActions(nodeType, mediaActions)
  cache.byType.set(nodeType, actions)
  return actions
}
