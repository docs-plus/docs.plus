import type * as Y from 'yjs'

import type { ApplyMode } from '../types'
import { CONTENT_APPLY_ORIGIN } from '../types'

/**
 * Transplant the scratch fragment into the live document as one atomic update.
 * Only `isDraft` and `needsInitialization` are touched. `store()` refuses to
 * persist a draft, and the empty-title-heading recipe would otherwise be
 * overwritten by the webapp's starter template on first open.
 */
export const applyContentToDoc = (doc: Y.Doc, scratch: Y.Doc, mode: ApplyMode): void => {
  const fragment = doc.getXmlFragment('default')
  const source = scratch.getXmlFragment('default')

  // Clone before any mutation, not incidentally. `clone()` recurses, so a throw
  // on pathological input has to land while the live fragment is still whole.
  // Delete-first would broadcast a half-wipe to every collaborator. The cast
  // drops YXmlHook, which insert() rejects and the transformer never produces.
  const nodes = source.toArray().map((node) => node.clone()) as (Y.XmlElement | Y.XmlText)[]

  doc.transact(() => {
    if (mode === 'replace' && fragment.length > 0) fragment.delete(0, fragment.length)
    fragment.insert(fragment.length, nodes)
    const metadata = doc.getMap('metadata')
    metadata.set('isDraft', false)
    metadata.set('needsInitialization', false)
  }, CONTENT_APPLY_ORIGIN)
}
