import * as Y from 'yjs'

import { isRecord } from './isRecord'

const MEDIA_ROUTE_SEGMENT = '/api/plugins/hypermultimedia/'

// The whole route, not `/hypermultimedia/` alone. That segment also occurs in
// third-party paths, and `replace` keeps the origin. A raw.githubusercontent URL
// under `extension-hypermultimedia/assets/` therefore had its last two segments
// swapped for a prefix that does not exist. Bounded to URL-safe runs so a query ends it.
const MEDIA_URL_PATTERN = /\/api\/plugins\/hypermultimedia\/([^/?#"'\s\\]+)\/([^/?#"'\s\\]+)/g

// A dot segment is traversal, never an id. S3's `copyObject` has no containment
// check, so keeping one out of the reference list has to happen here.
const isDotSegment = (segment: string): boolean => segment === '.' || segment === '..'

/** One object the snapshot names. `documentId` is the prefix the URL carries, not
 *  the source's id — a copy of a copy can still name the original. */
export interface MediaReference {
  documentId: string
  fileName: string
}

export interface RehostedSnapshot {
  /** `null` when the snapshot names no media — the caller writes its bytes as-is. */
  data: Buffer<ArrayBuffer> | null
  references: MediaReference[]
}

type Attrs = Record<string, unknown>

const rewriteValue = (
  value: string,
  targetDocumentId: string,
  found: Map<string, MediaReference>
): string | null => {
  let changed = false
  const next = value.replace(MEDIA_URL_PATTERN, (match, documentId: string, fileName: string) => {
    if (documentId === targetDocumentId) return match
    if (isDotSegment(documentId) || isDotSegment(fileName)) return match
    found.set(`${documentId}/${fileName}`, { documentId, fileName })
    changed = true
    return `${MEDIA_ROUTE_SEGMENT}${targetDocumentId}/${fileName}`
  })
  return changed ? next : null
}

// Element attrs hold the URL directly (`src`, `poster`); a mark's attrs arrive
// nested under the mark name (hyperlink's `href`). Matching on the value rather
// than the attribute name covers both, and any media attribute added later.
const rehostAttrs = (
  attrs: Attrs,
  targetDocumentId: string,
  found: Map<string, MediaReference>
): Attrs | null => {
  let changed: Attrs | null = null
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string') {
      const next = rewriteValue(value, targetDocumentId, found)
      if (next !== null) (changed ??= {})[key] = next
    } else if (isRecord(value)) {
      const nested = rehostAttrs(value, targetDocumentId, found)
      // Marks are replaced whole — `format` takes the complete attribute value.
      if (nested) (changed ??= {})[key] = { ...value, ...nested }
    }
  }
  return changed
}

// `toDelta` ops insert either a string or a one-position embed, so the running
// index must not assume a string length. Collected first, applied after, so a
// `format` call can never be measured against a half-walked delta.
const rehostText = (
  ytext: Y.XmlText,
  targetDocumentId: string,
  found: Map<string, MediaReference>
): void => {
  const edits: { index: number; length: number; attrs: Attrs }[] = []
  let index = 0

  for (const op of ytext.toDelta() as { insert: unknown; attributes?: Attrs }[]) {
    const length = typeof op.insert === 'string' ? op.insert.length : 1
    const changed = op.attributes ? rehostAttrs(op.attributes, targetDocumentId, found) : null
    if (changed) edits.push({ index, length, attrs: changed })
    index += length
  }

  for (const edit of edits) ytext.format(edit.index, edit.length, edit.attrs)
}

const rehostNode = (
  node: unknown,
  targetDocumentId: string,
  found: Map<string, MediaReference>
): void => {
  if (node instanceof Y.XmlText) return rehostText(node, targetDocumentId, found)

  if (node instanceof Y.XmlElement) {
    const changed = rehostAttrs(node.getAttributes() as Attrs, targetDocumentId, found)
    if (changed) {
      for (const [key, value] of Object.entries(changed)) node.setAttribute(key, value as string)
    }
  }
  // XmlElement extends XmlFragment, so this recurses into both.
  if (node instanceof Y.XmlFragment) {
    for (const child of node.toArray()) rehostNode(child, targetDocumentId, found)
  }
}

/**
 * Repoints a duplicated snapshot's media URLs at the copy's own storage prefix. It
 * reports every object they named, so the caller copies exactly those and nothing
 * else. Mutating the decoded doc rather than rebuilding it keeps every Yjs item
 * identity, which a transformer round-trip would mint afresh.
 */
export const rehostMediaUrls = (data: Uint8Array, targetDocumentId: string): RehostedSnapshot => {
  // Yjs v1 writes attribute strings as literal UTF-8, so bytes without this
  // sequence cannot name media. Skipping the decode keeps the common case free
  // and leaves an undecodable snapshot copyable byte-for-byte.
  const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (raw.indexOf(MEDIA_ROUTE_SEGMENT) < 0) return { data: null, references: [] }

  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, data instanceof Buffer ? new Uint8Array(data) : data)

  // Keyed by prefix + name so a URL repeated across nodes is copied once.
  const found = new Map<string, MediaReference>()
  ydoc.transact(() => rehostNode(ydoc.getXmlFragment('default'), targetDocumentId, found))
  if (found.size === 0) return { data: null, references: [] }

  return { data: Buffer.from(Y.encodeStateAsUpdate(ydoc)), references: [...found.values()] }
}
