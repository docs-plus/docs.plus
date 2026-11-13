import type { EditorState, Plugin, Transaction } from '@tiptap/pm/state'

// PluginKey adds a suffix when a key name repeats (`y-sync$1` in the app), so match the name.
// y-tiptap is not a dependency, so its own key cannot be imported here.
const Y_SYNC_KEY_RE = /^y-sync\$\d*$/

type YSyncMeta = { isChangeOrigin?: boolean; isUndoRedoOperation?: boolean } | undefined

// One lookup per plugin set. A miss is cached too, so an editor without collaboration scans once.
const ySyncByPlugins = new WeakMap<readonly Plugin[], Plugin | null>()

function ySyncPlugin(state: EditorState): Plugin | null {
  const { plugins } = state
  if (ySyncByPlugins.has(plugins)) return ySyncByPlugins.get(plugins) ?? null
  const found =
    plugins.find((plugin) => Y_SYNC_KEY_RE.test((plugin as unknown as { key: string }).key)) ?? null
  ySyncByPlugins.set(plugins, found)
  return found
}

/** A peer's change or a first load, not y-undo. y-tiptap marks y-undo with `isUndoRedoOperation`. */
export function isRemoteSync(transactions: readonly Transaction[], state: EditorState): boolean {
  const ySync = ySyncPlugin(state)
  if (!ySync) return false
  const remote = (tr: Transaction): boolean => {
    const meta = tr.getMeta(ySync) as YSyncMeta
    return !!meta?.isChangeOrigin && !meta.isUndoRedoOperation
  }
  return transactions.every((tr) => {
    if (!tr.docChanged) return true
    // Another plugin's reply to a peer's change is not this user's typing either.
    const root = tr.getMeta('appendedTransaction') as Transaction | undefined
    return remote(tr) || (!!root && remote(root))
  })
}
