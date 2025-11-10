import { useEffect, useState } from 'react'
import { db, TDocFilter } from '@db/headingCrinckleDB'
import getHeadingsFilterMap from './helpers/filterLogic'
import { useRouter } from 'next/router'
import { useStore } from '@stores'

const useApplyFilters = () => {
  const router = useRouter()
  const { slugs } = router.query as { slugs: string[] }
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const {
    editor: { loading, instance: editor, filterResult }
  } = useStore((state) => state.settings)

  const [isDocumentReady, setIsDocumentReady] = useState(false)

  useEffect(() => {
    const checkDocumentReady = () => {
      const headings = document.querySelectorAll('.heading .title')
      if (headings.length > 0) {
        setIsDocumentReady(true)
      } else {
        // If document is not ready, check again after a short delay
        setTimeout(checkDocumentReady, 200)
      }
    }

    checkDocumentReady()
  }, [])

  useEffect(() => {
    if (!isDocumentReady) return
    if (!slugs) return
    // if slugs is empty, then remove all filters data set
    if (slugs.length === 1 && filterResult.selectedNodes.length > 0) {
      setWorkspaceEditorSetting('filterResult', { sortedSlugs: [], selectedNodes: [] })
      setWorkspaceEditorSetting('applyingFilters', true)
      localStorage.setItem('headingMap', JSON.stringify([]))
      // toggle applyingFilters, in order to trigger the Editor to re-render
      setTimeout(() => {
        setWorkspaceEditorSetting('applyingFilters', false)
      }, 500)
      return
    }
    if (!editor || loading || slugs.length === 1) return

    // remove the document slug from the slugs array
    slugs.shift()

    const headings = document.querySelectorAll('.heading .title') as NodeListOf<HTMLElement>

    if (!headings) {
      console.error('[apply filter]: document is empty, no headings found')
      return
    }

    const { headingIdsMap, sortedSlugs, selectedNodes } = getHeadingsFilterMap(
      slugs,
      Array.from(headings)
    )

    const dbHeadigMap: TDocFilter[] = []
    headings.forEach((header) => {
      const wrapBlock = header.closest('.wrapBlock')
      const id = wrapBlock?.getAttribute('data-id')
      // if id is null then skip
      if (id) {
        dbHeadigMap.push({
          headingId: id,
          crinkleOpen: headingIdsMap.has(id) ? true : false
        })
      }
    })

    // save the data to indexedDB
    db.docFilter.bulkPut(dbHeadigMap)
    // .then((e) => {
    //   console.info('bulkPut', e)
    // })

    localStorage.setItem('headingMap', JSON.stringify(dbHeadigMap))

    setTimeout(() => {
      setWorkspaceEditorSetting('filterResult', { sortedSlugs, selectedNodes })
      setWorkspaceEditorSetting('applyingFilters', false)
    }, 300)
  }, [loading, isDocumentReady, slugs])
}

export default useApplyFilters
