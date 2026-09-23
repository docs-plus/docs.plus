import { TiptapTransformer } from '@hocuspocus/transformer'
import type { JSONContent } from '@tiptap/core'
import type * as Y from 'yjs'

import { blockText } from '../../../lib/blockText'
import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import type { ReadFormat, ReadOutcome, TiptapDocJson } from '../types'

/** Persisted snapshot bytes → Tiptap JSON or plain text. Corrupt bytes fail closed. */
export const readContent = (data: Uint8Array | Buffer, format: ReadFormat): ReadOutcome => {
  const decoded = ydocToPmJson(data)
  if (!decoded.ok) return { ok: false, error: decoded.error }
  return {
    ok: true,
    content:
      format === 'text'
        ? blockText(Array.isArray(decoded.json.content) ? decoded.json.content : [], '\n')
        : (decoded.json as unknown as TiptapDocJson)
  }
}

/** The shape GET returns for a document that has metadata but no snapshot row yet. */
export const emptyContent = (format: ReadFormat): TiptapDocJson | string =>
  format === 'text' ? '' : { type: 'doc', content: [] }

/** The same schema-free conversion `ydocToPmJson` runs, on a loaded room, so a rev matches either source. */
export const liveDocJson = (doc: Y.Doc): JSONContent =>
  (TiptapTransformer.fromYdoc(doc, 'default') as JSONContent | null) ?? { type: 'doc', content: [] }
