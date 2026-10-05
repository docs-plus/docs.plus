import { useSyncExternalStore } from 'react'

import {
  DOCUMENTS_SCOPE_STORAGE_KEY,
  DOCUMENTS_SORT_STORAGE_KEY,
  type DocumentsScope
} from '../constants'
import type { DocumentSortKey } from '../types'

type Option<T extends string> = { value: T; label: string }

// Sort labels map 1:1 to the backend `sort` enum; server-side only (client sort breaks Load more).
const SORT_OPTIONS: Option<DocumentSortKey>[] = [
  { value: 'updatedAt_desc', label: 'Last modified' },
  { value: 'lastOpenedAt_desc', label: 'Last opened' },
  { value: 'createdAt_desc', label: 'Date created' },
  { value: 'title_asc', label: 'Name (A→Z)' },
  { value: 'title_desc', label: 'Name (Z→A)' }
]

const LIST_SCOPE_OPTIONS: Option<DocumentsScope>[] = [
  { value: 'all', label: 'All documents' },
  { value: 'owned', label: 'Owned by me' },
  { value: 'joined', label: 'Joined' }
]

// Last opened is the owner's stamp, so a joined-only list has no order for it.
const JOINED_SORT_OPTIONS = SORT_OPTIONS.filter((o) => o.value !== 'lastOpenedAt_desc')

const DEFAULT_SCOPE: DocumentsScope = 'all'
const DEFAULT_SORT: DocumentSortKey = 'updatedAt_desc'

// sessionStorage fires no `storage` event in its own tab, so each write notifies these.
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const readStored = <T extends string>(key: string, options: Option<T>[], fallback: T): T => {
  const stored = window.sessionStorage.getItem(key)
  return options.find((o) => o.value === stored)?.value ?? fallback
}

const writeStored = (key: string, value: string) => {
  window.sessionStorage.setItem(key, value)
  listeners.forEach((listener) => listener())
}

const readScope = () => readStored(DOCUMENTS_SCOPE_STORAGE_KEY, LIST_SCOPE_OPTIONS, DEFAULT_SCOPE)
const readSort = () => readStored(DOCUMENTS_SORT_STORAGE_KEY, SORT_OPTIONS, DEFAULT_SORT)

/**
 * The Show and sort picks that Settings → Documents and the Home card share. Both read one
 * session key each, so both lists use one query key and a pick in one shows in the other.
 */
export function useDocumentsListPrefs() {
  const listScope = useSyncExternalStore(subscribe, readScope, () => DEFAULT_SCOPE)
  const storedSort = useSyncExternalStore(subscribe, readSort, () => DEFAULT_SORT)
  const isJoined = listScope === 'joined'

  return {
    listScope,
    // The stored sort stays as chosen, so it returns when the scope leaves Joined.
    sortKey: isJoined && storedSort === 'lastOpenedAt_desc' ? DEFAULT_SORT : storedSort,
    scopeOptions: LIST_SCOPE_OPTIONS,
    sortOptions: isJoined ? JOINED_SORT_OPTIONS : SORT_OPTIONS,
    setListScope: (value: DocumentsScope) => writeStored(DOCUMENTS_SCOPE_STORAGE_KEY, value),
    setSortKey: (value: DocumentSortKey) => writeStored(DOCUMENTS_SORT_STORAGE_KEY, value)
  }
}
