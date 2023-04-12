import React, { useCallback, useEffect, useState } from 'react'
import PubSub from 'pubsub-js'

function getOffsetTop(element) {
  return element ? element.offsetTop + getOffsetTop(element.offsetParent) : 0
}

import { useEditorStateContext } from '../../context/EditorContext'

const TableOfcontent = ({ editor, className }) => {
  const [items, setItems] = useState([])
  const {
    rendering,
    setRendering,
    loading,
    setLoading,
    applyingFilters,
    setApplyingFilters,
  } = useEditorStateContext()

  const handleUpdate = useCallback((doc) => {
    const headings = []
    const editorDoc = doc.editor?.state?.doc || doc.state.doc
    // TODO: check the object id performance
    // TODO: heading must be url frindly, so I have to map id with SLUGs
    editorDoc?.descendants((node, _pos, _parent, _index) => {
      if (node.type.name === 'contentHeading') {
        // https://stackoverflow.com/questions/59829232/offsettop-return-0

        let headingId = _parent.attrs?.id || node?.attrs.id || '1'
        let headingSection = document.querySelector(
          `.ProseMirror .heading[data-id="${headingId}"]`
        )
        let offsetTop = getOffsetTop(headingSection)

        // console.log({headingSection, offsetTop})

        if (offsetTop === 0) {
          headingId = '1'
          headingSection = document.querySelector(
            `.ProseMirror .heading[data-id="${headingId}"]`
          )
          offsetTop = getOffsetTop(headingSection)
        }

        headings.push({
          level: node.attrs?.level,
          text: node?.textContent,
          id: headingId,
          open: headingSection?.classList.contains('opend'),
          offsetTop: offsetTop,
        })
      }
    })
    setItems(headings)
  }, [])

  useEffect(() => {
    if (!editor) {
      return null
    }
    editor?.on('update', handleUpdate)
    let trTimer

    editor?.on('transaction', (tr, state) => {
      if (
        tr.transaction.meta?.foldAndunfold ||
        tr.transaction.meta?.renderTOC
      ) {
        // TODO: not good solotion, but it works
        // console.log("transaction", {tr, meta: tr.transaction.meta?.foldAndunfold})
        trTimer = setTimeout(() => {
          handleUpdate(tr)
        }, 200)
      }
    })

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => {
      editor?.off('transaction')
      editor?.off('update')
      clearTimeout(timer)
      clearTimeout(trTimer)
    }
  }, [editor])

  useEffect(() => {
    const transaction = editor.state.tr
    transaction.setMeta('renderTOC', true)
    editor.view.dispatch(transaction)

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)
    return () => clearTimeout(timer)
  }, [applyingFilters])

  // useEffect(() => {
  //   PubSub.subscribe('toggleHeadingsContent', function (msg, data) {
  //     // handleUpdate(editor, data)
  //   })

  //   return () => PubSub.unsubscribe('toggleHeadingsContent')
  // }, [])

  const scroll2Header = (e) => {
    e.preventDefault()
    let id = e.target.getAttribute('data-id')
    const offsetParent = e.target
      .closest('.toc__item')
      .getAttribute('data-offsettop')

    if (offsetParent === '0') id = '1'

    document.querySelector(`.heading[data-id="${id}"]`)?.scrollIntoView()
  }

  const toggleSection = (item) => {
    document
      .querySelector(
        `.ProseMirror .heading[data-id="${item.id}"] .buttonWrapper .btnFold`
      )
      ?.click()

    setItems((x) =>
      items.map((i) => {
        if (i.id === item.id) {
          return {
            ...i,
            open: !i.open,
          }
        }

        return i
      })
    )
  }

  function renderToc(items) {
    const renderedItems = []
    let i = 0

    while (i < items.length) {
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
          className={`toc__item toc__item--${
            item.level
          } text-ellipsis overflow-hidden ${item.open ? '' : 'closed'}`}
          data-id={item.id}
          data-offsettop={item.offsetTop}
        >
          <span>
            <span
              className="btnFold"
              onClick={() => toggleSection(item)}
            ></span>
            <a
              className="text-black text-ellipsis overflow-hidden"
              data-id={item.id}
              href={`?${item.id}`}
              onClick={scroll2Header}
            >
              {item.text}
            </a>
          </span>

          {children.length > 0 && (
            <div className={`${item.open ? '' : '!hidden'}`}>
              {renderToc(children)}
            </div>
          )}
        </div>
      )
      i = j
    }

    return renderedItems
  }

  return (
    <div className={`${className}`}>
      <div className="toc__list ">{renderToc(items)}</div>
    </div>
  )
}

export default TableOfcontent
