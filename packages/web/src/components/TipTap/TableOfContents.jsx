import React, { useCallback, useEffect, useState } from 'react'

const TableOfcontent = ({ editor, className }) => {
  const [items, setItems] = useState([])

  const handleUpdate = useCallback(() => {
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

        headings.push({
          level: node.attrs?.level,
          text: node?.textContent,
          id: headingId,
          open: node?.attrs?.open,
          offsetTop: getOffsetTop(document.querySelector(`.tipta__editor [data-id="${headingId}"]`))
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
    // console.log("updat")
  }, [items])

  const scroll2Header = (e) => {
    e.preventDefault()
    // e closest li add class active
    // e.target.closest('.toc__item').classList.add('active')
    let id = e.target.getAttribute('data-id')
    const offsetParent = e.target.closest('.toc__item').getAttribute('data-offsettop')

    if (offsetParent === '0') id = '1'

    document.querySelector(`.heading[data-id="${id}"]`)?.scrollIntoView()
  }

  return (
    <div className={`${className}`}>
      <ul className="toc__list ">
        {items.map((item, index) => (
          <li key={index} className={`toc__item toc__item--${item.level} text-ellipsis overflow-hidden`} data-offsettop={item.offsetTop}>
            <a className="text-black text-ellipsis overflow-hidden" data-id={item.id} href={`?${item.id}`} onClick={scroll2Header}>{item.text}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TableOfcontent
