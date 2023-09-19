import { useEffect } from 'react'
import { db } from '../db'
import { useEditorStateContext } from '@context/EditorContext'
import getHeadingsFilterMap from './helpers/filterLogic'
import { useRouter } from 'next/router'

const useApplyFilters = (editor) => {
  const router = useRouter()
  const { slugs } = router.query
  const { setFilterResult, setApplyingFilters, rendering, loading } = useEditorStateContext()

  useEffect(() => {
    if (!editor || rendering || loading || slugs.length === 1) return

    // remove the document slug from the slugs array
    slugs.shift()

    const headings = document.querySelectorAll('.heading .title')

    if (!headings) {
      console.error('[apply filter]: document is empty, no headings found')
      return
    }
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
  }, [rendering, loading])
}

export default useApplyFilters
