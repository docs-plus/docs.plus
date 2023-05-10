import React, { useCallback, useEffect, useState } from 'react'
import { useEditorStateContext } from '../../context/EditorContext'

function getOffsetTop(element) {
  return element ? element.offsetTop + getOffsetTop(element.offsetParent) : 0
}

const TableOfContent = ({ editor, className }) => {
  const [items, setItems] = useState([])
  const { applyingFilters } = useEditorStateContext()

  const handleUpdate = useCallback((doc, data) => {
    const headings = []
    const editorDoc = doc.editor?.state?.doc || doc.state.doc

    editorDoc?.descendants((node, _pos, _parent, _index) => {
      if (node.type.name === 'contentHeading') {
        let headingId = _parent.attrs?.id || node?.attrs.id || '1'
        let headingSection = document.querySelector(
          `.ProseMirror .heading[data-id="${headingId}"]`
        )
        let offsetTop = getOffsetTop(headingSection)

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
    if (!editor) return null

    editor.on('update', handleUpdate)
    let trTimer

    editor.on('transaction', (tr, state) => {
      if (
        tr.transaction.meta?.foldAndunfold ||
        tr.transaction.meta?.renderTOC
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
  }, [editor, applyingFilters])

  useEffect(() => {
    const transaction = editor.state.tr
    transaction.setMeta('renderTOC', true)
    editor.view.dispatch(transaction)

    const timer = setTimeout(() => {
      handleUpdate(editor)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

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
          className={`
            toc__item toc__item--${item.level} text-ellipsis overflow-hidden ${
            item.open ? '' : 'closed'
          }
          `}
          data-id={item.id}
          data-offsettop={item.offsetTop}>
          <span>
            <span
              className="btnFold"
              onClick={() => toggleSection(item)}></span>
            <a
              className="text-black text-ellipsis overflow-hidden"
              data-id={item.id}
              href={`?${item.id}`}
              onClick={scroll2Header}>
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
