// toolbarUtils.js
import { useState } from 'react'

export const getLocalStorageBoolean = (key, defaultValue) => {
  const value = localStorage.getItem(key)
  return value !== null ? value === 'true' : defaultValue
}

export const setLocalStorageBoolean = (key, value) => {
  localStorage.setItem(key, value.toString())
}

export const useBooleanLocalStorageState = (key, defaultValue) => {
  const [state, setState] = useState(() => getLocalStorageBoolean(key, defaultValue))

  const updateState = (newValue) => {
    setState(newValue)
    setLocalStorageBoolean(key, newValue)
  }

  return [state, updateState]
}

export const searchThroughHeading = (e) => {
  const search = e.target.value
  const headings = document.querySelectorAll('.title')

  const filteredHeadings = Array.from(headings).filter((heading) => {
    const key = search
    const regex = new RegExp(key, 'i')
    if (regex.test(heading.textContent)) {
      return { node: heading, text: heading.textContent }
    }
  })

  return {
    searchValue: search,
    filteredHeadings,
    totalSearch: filteredHeadings.length,
    totalHeadings: headings.length
  }
}

export const applySearchThroughHeading = (searchInput, router) => {
  const search = searchInput
  const mainDoc = router.query.slugs.at(0)
  window.location.href = `/${mainDoc}/${encodeURIComponent(search)}`
}

export const saveDocDescriptionHandler = (mutate, docId, docDescription, tags) => {
  mutate({
    documentId: docId,
    description: docDescription,
    keywords: tags
  })
}

export const saveDocReadOnlyPage = (mutate, documentId, readOnly) => {
  mutate({
    documentId,
    readOnly
  })
}

export const highlightTocHeadings = (headings) => {
  const headingIds = headings.map((heading) => heading.closest('.heading').getAttribute('data-id'))
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
