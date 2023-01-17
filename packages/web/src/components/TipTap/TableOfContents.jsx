import React, { useCallback, useEffect, useState } from 'react'

export default ({ editor, className }) => {
  const [items, setItems] = useState([])

  const handleUpdate = useCallback(() => {
    const headings = []
    // TODO: check the object id performance
    // TODO: heading must be url frindly, so I have to map id with SLUGs
    editor?.state?.doc?.descendants((node, pos, parent, index) => {
      if (node.type.name === 'heading') {

        // https://stackoverflow.com/questions/59829232/offsettop-return-0
        function getOffsetTop(element) {
          return element ? (element.offsetTop + getOffsetTop(element.offsetParent)) : 0;
        }

        headings.push({
          level: node.firstChild?.attrs?.level,
          text: node.firstChild?.textContent,
          id: node.firstChild?.attrs.id,
          open: node?.attrs.open,
          offsetTop: getOffsetTop(document.querySelector(`.tipta__editor [data-id="${ node.firstChild?.attrs.id }"]`))
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
    const id = e.target.getAttribute('data-id')
    document.querySelector(`.title[data-id="${ id }"]`)?.scrollIntoView()
  }

  return (
    <div className={`${ className }`}>
      <ul className="toc__list ">
        {items.map((item, index) => (
          <li key={index} data-offsettop={item.offsetTop} className={`toc__item toc__item--${ item.level } text-ellipsis overflow-hidden`}>
            <a href={`?${ item.id }`} onClick={scroll2Header} data-id={item.id} className="text-black text-ellipsis overflow-hidden">{item.text}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

