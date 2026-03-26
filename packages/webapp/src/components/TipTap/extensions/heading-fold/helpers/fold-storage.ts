const STORAGE_PREFIX = 'editor-folds-'
// Migration: remove after 2026-Q3 — migrates old key to new prefix
const OLD_STORAGE_PREFIX = 'tinydocy-folds-'

function migrateOldKey(documentId: string): void {
  try {
    const oldKey = `${OLD_STORAGE_PREFIX}${documentId}`
    const newKey = `${STORAGE_PREFIX}${documentId}`
    const oldValue = localStorage.getItem(oldKey)
    if (oldValue && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldValue)
      localStorage.removeItem(oldKey)
    }
  } catch {
    // localStorage may be unavailable
  }
}

export function loadFoldedIds(documentId: string): Set<string> {
  migrateOldKey(documentId)
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentId}`)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

export function saveFoldedIds(documentId: string, foldedIds: Set<string>): void {
  try {
    if (foldedIds.size === 0) {
      localStorage.removeItem(`${STORAGE_PREFIX}${documentId}`)
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${documentId}`, JSON.stringify([...foldedIds]))
    }
  } catch {
    // localStorage may be full or unavailable
  }
}
