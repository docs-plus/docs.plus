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

/**
 * Whether y-sync wrote this change from the Y.Doc: `peer` is a peer's change or a first load,
 * `undo` is a y-undo. Another plugin's reply to such a change counts as the same origin.
 */
export function ySyncOrigin(tr: Transaction, state: EditorState): 'peer' | 'undo' | null {
  const ySync = ySyncPlugin(state)
  if (!ySync) return null
  const origin = (t: Transaction | undefined) => {
    const meta = t?.getMeta(ySync) as YSyncMeta
    if (!meta?.isChangeOrigin) return null
    return meta.isUndoRedoOperation ? 'undo' : 'peer'
  }
  return origin(tr) ?? origin(tr.getMeta('appendedTransaction') as Transaction | undefined)
}

/** Every doc change in the batch came from a peer or a first load, not from y-undo. */
export function isRemoteSync(transactions: readonly Transaction[], state: EditorState): boolean {
  return transactions.every((tr) => !tr.docChanged || ySyncOrigin(tr, state) === 'peer')
}
