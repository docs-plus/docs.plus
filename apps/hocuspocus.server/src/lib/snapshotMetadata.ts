import * as Y from 'yjs'

/** Prefix of the per-fragment position-migration maps written by `@tiptap/y-tiptap`. */
export const POSITION_MIGRATIONS_PREFIX = '__tiptap_position_migrations:'

/**
 * Deletes every live entry from every `__tiptap_position_migrations:*` shared root
 * inside one transaction. `Y.Map.clear()` adds only delete-set entries, so the
 * document's state vector stays byte-equal and the Y.Doc is never rebuilt.
 * Returns the total number of live entries cleared.
 */
export const clearPositionMigrations = (ydoc: Y.Doc): number => {
  // Snapshot keys before calling `getMap`: upgrading a raw AbstractType mutates `ydoc.share`.
  const keys = [...ydoc.share.keys()].filter((key) => key.startsWith(POSITION_MIGRATIONS_PREFIX))
  if (keys.length === 0) return 0

  let cleared = 0
  ydoc.transact(() => {
    for (const key of keys) {
      const map = ydoc.getMap(key)
      const liveEntries = map.size
      if (liveEntries > 0) {
        cleared += liveEntries
        map.clear()
      }
    }
  })
  return cleared
}

/**
 * Stored snapshots must not carry the transient metadata keys the client stamps
 * on the live doc (`commitMessage` rides the version row instead) or accumulated
 * `@tiptap/y-tiptap` position-migration maps. Its own module because `lib/queue.ts`
 * opens a Redis socket at import, and this needs only Yjs.
 */
export const stripSnapshotMetadata = (state: Uint8Array): Buffer<ArrayBuffer> => {
  const ydoc = new Y.Doc()
  try {
    Y.applyUpdate(ydoc, state instanceof Buffer ? new Uint8Array(state) : state)
    const meta = ydoc.getMap('metadata')
    meta.delete('commitMessage')
    meta.delete('isDraft')
    clearPositionMigrations(ydoc)
    return Buffer.from(Y.encodeStateAsUpdate(ydoc))
  } finally {
    ydoc.destroy()
  }
}
