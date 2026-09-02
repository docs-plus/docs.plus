import * as Y from 'yjs'

/**
 * Stored snapshots must not carry the transient metadata keys the client stamps
 * on the live doc; `commitMessage` rides the version row instead. Its own module
 * because `lib/queue.ts` opens a Redis socket at import, and this needs only Yjs.
 */
export const stripSnapshotMetadata = (state: Uint8Array): Buffer<ArrayBuffer> => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, state instanceof Buffer ? new Uint8Array(state) : state)
  const meta = ydoc.getMap('metadata')
  meta.delete('commitMessage')
  meta.delete('isDraft')
  return Buffer.from(Y.encodeStateAsUpdate(ydoc))
}
