import React, { useCallback, useEffect, useState } from 'react'
import { CaretRight } from '@icons'

const getOffsetTop = (element) => (element ? element.offsetTop + getOffsetTop(element.offsetParent) : 0)

const getHeadingDetails = (id) => {
  const headingSection = document.querySelector(`.ProseMirror .heading[data-id="${id}"]`)
  const offsetTop = getOffsetTop(headingSection)
  return { headingSection, offsetTop }
}

const TableOfContent = ({ editor, className }) => {
  const [items, setItems] = useState([])

  const handleUpdate = useCallback((doc) => {
    const headings = []
    const editorDoc = doc.editor?.state?.doc || doc.state.doc

    editorDoc?.descendants((node, _pos, _parent) => {
      if (node.type.name === 'contentHeading') {
        let headingId = _parent.attrs?.id || node?.attrs.id || '1'
        let { headingSection, offsetTop } = getHeadingDetails(headingId)

        if (offsetTop === 0) {
          headingId = '1'
          let headingDetails = getHeadingDetails(headingId)
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
    if (!editor) return null

    editor.on('update', handleUpdate)
    let trTimer

    editor.on('transaction', (tr) => {
      if (tr.transaction.meta?.foldAndunfold || tr.transaction.meta?.renderTOC) {
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
  }, [editor, handleUpdate])

  useEffect(() => {
    const transaction = editor.state.tr
    transaction.setMeta('renderTOC', true)
    editor.view.dispatch(transaction)

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  const scroll2Header = useCallback((e) => {
    e.preventDefault()
    let id = e.target.getAttribute('data-id')
    const heading = e.target.innerText
    const offsetParent = getOffsetTop(e.target.closest('.toc__item'))

    if (offsetParent === 0) id = '1'

    const url = new URL(window.location.href)
    url.searchParams.set('id', id)
    url.searchParams.set('heading', encodeURIComponent(heading))
    window.history.replaceState({}, '', url)

    document.querySelector(`.heading[data-id="${id}"]`)?.scrollIntoView()
  }, [])

  const toggleSection = useCallback((item) => {
    const itemElement = document.querySelector(`.toc__item[data-id="${item.id}"]`)
    const btnFoldElement = itemElement.querySelector(`.btnFold`)
    const childrenWrapperElement = itemElement.querySelector('.childrenWrapper')

    itemElement.classList.toggle('closed')
    btnFoldElement.classList.toggle('closed')
    btnFoldElement.classList.toggle('opened')
    childrenWrapperElement?.classList.toggle('hidden')

    document.querySelector(`.ProseMirror .heading[data-id="${item.id}"] .buttonWrapper .btnFold`)?.click()
  }, [])

  const renderToc = useCallback(
    (items) => {
      const renderedItems = []
      for (let i = 0; i < items.length; ) {
        const item = items[i]
        const children = []
        let j = i + 1

        while (j < items.length && items[j].level > item.level) {
          children.push(items[j])
          j++
        }
        renderedItems.push(
          <div
            key={item.id}
            className={`toc__item toc__item--${item.level} ${item.open ? '' : 'closed'}`}
            data-id={item.id}
            data-offsettop={item.offsetTop}>
            <span>
              <span
                className={`btnFold ${item.open ? 'opened' : 'closed'}`}
                onClick={() => toggleSection(item)}>
                <CaretRight size={17} fill="#363636" />
              </span>
              <a
                className="text-black line-clamp-2 hover:line-clamp-3 "
                data-id={item.id}
                href={`?${item.id}`}
                onClick={scroll2Header}>
                {item.text}
              </a>
            </span>

            {children.length > 0 && (
              <div className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderToc(children)}</div>
            )}
          </div>
        )
        i = j
      }

      return renderedItems
    },
    [toggleSection, scroll2Header]
  )

  if (items.length) {
    const { id, offsetTop } = items.at(-1)
    if (id === '1' && offsetTop === 0) return null
  }

  return (
    <div className={`${className}`}>
      <div className="toc__list ">{renderToc(items)}</div>
    </div>
  )
}

export default TableOfContent
