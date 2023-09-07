import { useEffect } from 'react'
import { db } from '../db'
import { useEditorStateContext } from '@context/EditorContext'
import getHeadingsFilterMap from './helpers/filterLogic'

const useApplyFilters = (editor, slugs, applyingFilters, setApplyingFilters, router, rendering) => {
  const { setFilterResult } = useEditorStateContext()

  useEffect(() => {
    if (!editor || rendering || slugs.length === 1) return
    // remove the document slug from the slugs array
    slugs.shift()

    const headings = document.querySelectorAll('.heading .title')
    const { headingIdsMap, sortedSlugs, selectedNodes } = getHeadingsFilterMap(slugs, headings)

    const dbHeadigMap = []
    headings.forEach((header) => {
      const wrapBlock = header.closest('.wrapBlock')
      const id = wrapBlock.getAttribute('data-id')
      dbHeadigMap.push({
        headingId: id,
        crinkleOpen: headingIdsMap.has(id) ? true : false
      })
    })

    // save the data to indexedDB
    db.docFilter.bulkPut(dbHeadigMap)
    // .then((e) => {
    //   console.info('bulkPut', e)
    // })

    localStorage.setItem('headingMap', JSON.stringify(dbHeadigMap))

    const timer = setTimeout(() => {
      setFilterResult({ sortedSlugs, selectedNodes })
      setApplyingFilters(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [rendering])
}

export default useApplyFilters
