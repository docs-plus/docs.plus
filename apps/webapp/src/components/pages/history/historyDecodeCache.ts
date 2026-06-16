import { tryGetProsemirrorFromHistoryYdoc } from './helpers'

const MAX_ENTRIES = 24

let scopedDocumentId: string | undefined
const cache = new Map<number, unknown>()

export function bindHistoryDecodeCache(documentId: string | undefined): void {
  if (scopedDocumentId === documentId) return
  scopedDocumentId = documentId
  cache.clear()
}

export function getCachedProsemirrorFromHistoryYdoc(
  version: number,
  data: string | undefined
): unknown | null {
  if (data == null || data === '') return null

  if (cache.has(version)) {
    const hit = cache.get(version)
    cache.delete(version)
    cache.set(version, hit)
    return hit ?? null
  }

  const doc = tryGetProsemirrorFromHistoryYdoc(data)
  if (doc == null) return null

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(version, doc)
  return doc
}

export function clearHistoryDecodeCache(): void {
  cache.clear()
}
