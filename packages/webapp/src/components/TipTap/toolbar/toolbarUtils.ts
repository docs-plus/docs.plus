import type { UseMutateFunction } from '@tanstack/react-query'
import type { NextRouter } from 'next/router'
import { useState } from 'react'

export const getLocalStorageBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = localStorage.getItem(key)
  return value !== null ? value === 'true' : defaultValue
}

export const setLocalStorageBoolean = (key: string, value: boolean): void => {
  localStorage.setItem(key, value.toString())
}

export const useBooleanLocalStorageState = (
  key: string,
  defaultValue: boolean
): [boolean, (newValue: boolean) => void] => {
  const [state, setState] = useState(() => getLocalStorageBoolean(key, defaultValue))

  const updateState = (newValue: boolean): void => {
    setState(newValue)
    setLocalStorageBoolean(key, newValue)
  }

  return [state, updateState]
}

interface SearchResult {
  searchValue: string
  filteredHeadings: Element[]
  totalSearch: number
  totalHeadings: number
}

export const searchThroughHeading = (e: React.ChangeEvent<HTMLInputElement>): SearchResult => {
  const search = e.target.value
  const headings = document.querySelectorAll('.title')

  const filteredHeadings = Array.from(headings).filter((heading) => {
    const key = search
    const regex = new RegExp(key, 'i')
    return regex.test(heading.textContent || '')
  })

  return {
    searchValue: search,
    filteredHeadings,
    totalSearch: filteredHeadings.length,
    totalHeadings: headings.length
  }
}

export const applySearchThroughHeading = (searchInput: string, router: NextRouter): void => {
  const url = new URL(router.asPath, window.location.origin)
  url.pathname = `${url.pathname}/${encodeURIComponent(searchInput)}`
  router.push(url.toString(), undefined, { shallow: true })
}

interface DocumentMetadataUpdate {
  documentId: string
  description?: string
  keywords?: string[]
}

export const saveDocDescriptionHandler = <TData = unknown, TError = unknown, TContext = unknown>(
  mutate: UseMutateFunction<TData, TError, DocumentMetadataUpdate, TContext>,
  docId: string,
  docDescription: string,
  tags: string[]
): void => {
  mutate({
    documentId: docId,
    description: docDescription,
    keywords: tags
  })
}

interface ReadOnlyUpdate {
  documentId: string
  readOnly?: boolean
}

export const saveDocReadOnlyPage = <TData = unknown, TError = unknown, TContext = unknown>(
  mutate: UseMutateFunction<TData, TError, ReadOnlyUpdate, TContext>,
  documentId: string,
  readOnly: boolean
): void => {
  mutate({
    documentId,
    readOnly
  })
}

export const highlightTocHeadings = (headings: Element[]): void => {
  const headingIds = headings.map((heading) => heading.closest('.heading')?.getAttribute('data-id'))
  const tocHeadings = document.querySelectorAll('.tiptap__toc .toc__item a')

  tocHeadings.forEach((tocItem) => {
    const isHeadingInList = headingIds.includes(tocItem.getAttribute('data-id'))

    if (isHeadingInList) {
      tocItem.classList.add('bg-yellow-200')
      tocItem.classList.remove('text-black')
    } else {
      tocItem.classList.add('text-black')
      tocItem.classList.remove('bg-yellow-200')
    }
  })
}
