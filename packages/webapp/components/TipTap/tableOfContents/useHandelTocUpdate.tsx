import { useState, useCallback, useEffect } from 'react'
import { getHeadingDetails } from './helper'
import ENUMS from '../enums'
import { useStore } from '@stores'

type Theading = {
  level: number
  text: string
  id: string
  open: boolean | undefined
  offsetTop: number
}

const useHandelTocUpdate = () => {
  const [items, setItems] = useState<Theading[]>([])
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const handleUpdate = useCallback((doc: any) => {
    const headings: Theading[] = []
    const editorDoc = doc.editor?.state?.doc || doc.state.doc

    editorDoc?.descendants((node: any, _pos: any, _parent: any) => {
      if (node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
        let headingId = _parent.attrs?.id || node?.attrs.id || '1'
        let { headingSection, offsetTop } = getHeadingDetails(headingId)

        if (offsetTop === 0) {
          headingId = '1'
          const headingDetails = getHeadingDetails(headingId)
          headingSection = headingDetails.headingSection
          offsetTop = headingDetails.offsetTop
        }

        headings.push({
          level: node.attrs?.level,
          text: node?.textContent,
          id: headingId,
          open: headingSection?.classList.contains('opend'),
          offsetTop: offsetTop
        })
      }
    })

    setItems(headings)
  }, [])

  useEffect(() => {
    if (!editor) return

    let trTimer: ReturnType<typeof setTimeout>

    editor.on('transaction', (tr: any) => {
      if (tr.transaction.selection.$anchor.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
        handleUpdate(tr)
      }

      if (
        tr.transaction.meta?.foldAndunfold ||
        tr.transaction.meta?.renderTOC ||
        tr.transaction.meta?.paste
      ) {
        trTimer = setTimeout(() => {
          handleUpdate(tr)
        }, 1000)
      }
    })

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => {
      editor.off('transaction')
      editor.off('update')
      clearTimeout(timer)
      clearTimeout(trTimer)
    }
  }, [editor])

  // first initial render
  useEffect(() => {
    const transaction = editor.state.tr
    transaction.setMeta('renderTOC', true)
    editor.view.dispatch(transaction)

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  return { items }
}

export default useHandelTocUpdate
