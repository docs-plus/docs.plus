import { useEffect } from 'react'

import { db } from '../db'

const getHeaderParents = (heading) => {
  if (!heading) return
  const hLevel = heading.getAttribute('level')
  const parents = []
  // loop through the headings to find the parent heading untile the level is 1
  for (let i = +hLevel; i >= 1; i--) {
    const pHeading = heading.closest(`[level="${i}"]`)?.querySelector('.title')
    if (pHeading)
      parents.push({
        node: pHeading,
        text: pHeading.textContent,
        hLevel: i,
        id: pHeading.closest('.wrapBlock').getAttribute('data-id')
      })
  }

  return parents
}

const useApplyFilters = (editor, slugs, applyingFilters, setApplyingFilters, router, rendering) => {
  useEffect(() => {
    if (!editor || rendering || slugs.length === 1) return

    const headings = document.querySelectorAll('.heading .title')

    // search through the headings that has text content with "diet" with regex
    const filteredHeadings = Array.from(headings)
      .filter((heading) => {
        const key = slugs.at(-1)

        const regex = new RegExp(key, 'i') // i flag makes the regex case-insensitive
        if (regex.test(heading.textContent)) {
          return { node: heading, text: heading.textContent }
        }
      })
      .map((heading) => {
        return {
          node: heading,
          parents: getHeaderParents(heading).map((parent) => parent.id),
          text: heading.textContent,
          hLevel: heading.getAttribute('level'),
          id: heading.closest('.wrapBlock').getAttribute('data-id')
        }
      })
      .map((heading) => {
        return {
          ...heading,
          openSectionIds: [heading.id, ...heading.parents]
        }
      })

    const headingIds = filteredHeadings.map((heading) => heading.openSectionIds).flat()

    const uniqueArr = [...new Set(headingIds)]

    // if the filter result is empty, then redirect to the first slug
    if (uniqueArr.length === 0) {
      router.push(slugs.at(0))
      setApplyingFilters(false)
      return
    }

    const dbMap = []
    headings.forEach((header) => {
      const wrapBlock = header.closest('.wrapBlock')
      const id = wrapBlock.getAttribute('data-id')

      if (!uniqueArr.includes(id)) {
        dbMap.push({
          headingId: id,
          crinkleOpen: false
        })
      } else {
        dbMap.push({
          headingId: id,
          crinkleOpen: true
        })
      }
    })

    // save the data to indexedDB
    db.docFilter.bulkPut(dbMap)
    // .then((e) => {
    //   console.info('bulkPut', e)
    // })

    localStorage.setItem('headingMap', JSON.stringify(dbMap))

    const timer = setTimeout(() => {
      setApplyingFilters(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [rendering])
}

export default useApplyFilters
