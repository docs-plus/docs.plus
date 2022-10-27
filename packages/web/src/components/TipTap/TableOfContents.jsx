import React, { useCallback, useEffect, useState } from 'react'
import { ObjectID } from 'bson';

export default ({ editor, className }) => {
  const [items, setItems] = useState([])


  const handleUpdate = useCallback(() => {
    const headings = []
    const transaction = editor?.state?.tr

    // console.log(id.toString());
    let reserveHeadingId = ''
    let reserveHeadingLevel = ''

    // TODO: check the object id performance
    // TODO: heading must be url frindly, so I have to map id with SLUGs
    editor?.state?.doc?.descendants((node, pos, parent, index) => {


      if (node.type.name === 'heading') {
        reserveHeadingId = node.attrs.id
        reserveHeadingLevel = node.attrs.level
      } else {
        // console.log(reserveHeadingId, reserveHeadingLevel)
        // console.log({
        //   node, parent,
        //   currentNode: node?.type?.name,
        //   nodeContent: node?.textContent,
        //   pos,
        //   parrentNode: parent?.type?.name,
        //   index,
        // })
      }



      // transaction.setNodeMarkup(pos, undefined, {
      //   ...node.attrs,
      //   parent: reserveHeadingId || "0",
      //   level: "" + reserveHeadingLevel || "0"
      // })



      if (node.type.name === 'contentHeading') {
        // console.log(node.content.toJSON());
        // const nodeContent = node.content.toJSON() ? node.content.toJSON()[0]?.text : "Heading"
        // const id = new ObjectID().toString()

        // if (node.attrs.id !== id) {
        //   transaction.setNodeMarkup(pos, undefined, {
        //     ...node.attrs,
        //     id,
        //   })
        // }

        // console.log(node.type)

        headings.push({
          level: node.attrs.level,
          text: node.textContent,
          // id: node.attrs.id
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

