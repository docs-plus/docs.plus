import React, { useCallback, useEffect, useState } from 'react'
import { ObjectID } from 'bson';

export default ({ editor, className }) => {
  const [items, setItems] = useState([])


  const handleUpdate = useCallback(() => {
    const headings = []
    const transaction = editor?.state?.tr

    // console.log(id.toString());

    // TODO: check the object id performance
    // TODO: heading must be url frindly, so I have to map id with SLUGs
    editor?.state?.doc?.descendants((node, pos) => {
      // console.log(node.type.name)
      if (node.type.name === 'heading') {
        // console.log(node.content.toJSON())
        // const nodeContent = node.content.toJSON() ? node.content.toJSON()[0]?.text : "Heading"
        const id = new ObjectID().toString()
        if (node.attrs.id !== id) {
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id,
          })
        }

        headings.push({
          level: node.attrs.level,
          text: node.textContent,
          id,
        })
      }
    })

    transaction.setMeta('addToHistory', false)
    transaction.setMeta('preventUpdate', true)

    editor.view.dispatch(transaction)

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



  return (

    <div className={`${ className }`}>
      <ul className="toc__list ">
        {items.map((item, index) => (
          <li key={index} className={`toc__item toc__item--${ item.level } text-ellipsis overflow-hidden`}>
            <a href={`#${ item.id }`} className="text-black text-ellipsis overflow-hidden">{item.text}</a>
          </li>
        ))}
      </ul>
    </div>

  )
}

