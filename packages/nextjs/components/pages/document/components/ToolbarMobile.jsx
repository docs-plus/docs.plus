import { useEffect, useState, useCallback, useRef } from 'react'
import { OrderListMobile, BoldMobile, ItalicMobile, UnderlineMobile, InsertLinkMobile } from '@icons'

const setLink = (editor) => {
  return () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (editor.isActive('link')) {
      return editor.chain().focus().unsetLink().run()
    }

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()

      return
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
}

const Toolbar = ({ editor }) => {
  if (!editor) {
    return null
  }

  return (
    <div className="tiptap__toolbar text-blue-700 editorButtons justify-evenly flex flex-row items-center py-1 px-4">
      <button
        className={editor.isActive('bold') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldMobile size="24" fill={editor.isActive('bold') ? 'text-blue-700' : ''} />
      </button>

      <button
        className={editor.isActive('italic') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicMobile size="24" fill={editor.isActive('italic') ? 'text-blue-700' : ''} />
      </button>

      <button
        className={editor.isActive('underline') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineMobile size="24" fill={editor.isActive('underline') ? 'text-blue-700' : ''} />
      </button>

      <button
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <OrderListMobile size="26" fill={editor.isActive('orderedList') ? 'text-blue-700' : ''} />
      </button>

      <button className={editor.isActive('link') ? 'is-active' : ''} onClick={setLink}>
        <InsertLinkMobile size="26" fill={editor.isActive('link') ? 'text-blue-700' : ''} />
      </button>
    </div>
  )
}

export default Toolbar
