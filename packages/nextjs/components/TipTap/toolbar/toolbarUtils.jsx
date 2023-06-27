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

  return { searchValue: search, totalSearch: filteredHeadings.length, totalHeadings: headings.length }
}

export const applySerchThroughHeading = (searchInput, router) => {
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

// More functions...
