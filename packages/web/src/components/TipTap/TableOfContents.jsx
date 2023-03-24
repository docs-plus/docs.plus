import React, { useCallback, useEffect, useState } from 'react'
import PubSub from 'pubsub-js'

const TableOfcontent = ({ editor, className }) => {
  const [items, setItems] = useState([])

  const handleUpdate = useCallback((data) => {
    const headings = []

    // TODO: check the object id performance
    // TODO: heading must be url frindly, so I have to map id with SLUGs
    editor?.state?.doc?.descendants((node, _pos, _parent, _index) => {
      if (node.type.name === 'contentHeading') {
        // https://stackoverflow.com/questions/59829232/offsettop-return-0
        function getOffsetTop (element) {
          return element ? (element.offsetTop + getOffsetTop(element.offsetParent)) : 0
        }

        const headingId = _parent.attrs?.id || node?.attrs.id || '1'
        const headingSection = document.querySelector(`.ProseMirror .heading[data-id="${headingId}"]`)

        headings.push({
          level: node.attrs?.level,
          text: node?.textContent,
          id: headingId,
          open: data && headingId === data.headingId ? data.crinkleOpen : headingSection?.classList.contains('opend'),
          offsetTop: getOffsetTop(headingSection)
        })
      }
    })
    setItems(headings)
  }, [editor])

  useEffect(handleUpdate, [])

  useEffect(() => {
    if (!editor) {
      return null
    }
    editor?.on('update', handleUpdate)

    return () => {
      editor?.off('update', handleUpdate)
    }
  }, [editor])

  useEffect(() => {
    PubSub.subscribe('toggleHeadingsContent', function (messag, data) {
      handleUpdate(data)
    })

    return () => PubSub.unsubscribe('toggleHeadingsContent')
  }, [])

  const scroll2Header = (e) => {
    e.preventDefault()
    let id = e.target.getAttribute('data-id')
    const offsetParent = e.target.closest('.toc__item').getAttribute('data-offsettop')

    if (offsetParent === '0') id = '1'

    document.querySelector(`.heading[data-id="${id}"]`)?.scrollIntoView()
  }

  // console.log(newItems)

  const toggleSection = (item) => {
    document
      .querySelector(`.ProseMirror .heading[data-id="${item.id}"] .buttonWrapper .btnFold`)?.click()

    setItems(x => items.map((i) => {
      if (i.id === item.id) {
        return {
          ...i,
          open: !i.open
        }
      }

      return i
    }))
  }

  function renderToc (items) {
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
        className={`toc__item toc__item--${item.level} text-ellipsis overflow-hidden ${item.open ? '' : 'closed'}`}
        data-id={item.id}
        data-offsettop={item.offsetTop}
      >
        <span>
          <span className='btnFold' onClick={() => toggleSection(item)}></span>
          <a className="text-black text-ellipsis overflow-hidden" data-id={item.id} href={`?${item.id}`} onClick={scroll2Header}>
            {item.text}
          </a>
        </span>

        {children.length > 0 && <div className={`${item.open ? '' : '!hidden'}`}>{renderToc(children)}</div>}
      </div>
      )
      i = j
    }

    return renderedItems
  }

  return (<div className={`${className}`}>
  <div className="toc__list ">
    {renderToc(items)}
  </div>
</div>)
}

export default TableOfcontent
