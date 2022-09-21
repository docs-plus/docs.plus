import './styles.scss'
import React, { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import StarterKit from '@tiptap/starter-kit'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import TableOfContents from "./TableOfContents.jsx"
import HeadingID from './TableOfContents.js'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import randomColor from 'randomcolor'


const MenuBar = ({ editor }) => {
  if (!editor) {
    return null
  }

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink()
        .run()

      return
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url })
      .run()
  }, [editor])

  const addImage = useCallback(() => {
    const url = window.prompt('URL')

    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  return (
    <div className='editorButtons'>
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
      >
        bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
      >
        italic
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
      >
        strike
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'is-active' : ''}
      >
        code
      </button>


      <div className='divided'></div>

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={editor.isActive('codeBlock') ? 'is-active' : ''}
      >
        code block
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'is-active' : ''}
      >
        blockquote
      </button>

      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive('paragraph') ? 'is-active' : ''}
      >
        paragraph
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
      >
        h1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
      >
        h2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
      >
        h3
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        className={editor.isActive('heading', { level: 4 }) ? 'is-active' : ''}
      >
        h4
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
        className={editor.isActive('heading', { level: 5 }) ? 'is-active' : ''}
      >
        h5
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
        className={editor.isActive('heading', { level: 6 }) ? 'is-active' : ''}
      >
        h6
      </button>
      <div className='divided'></div>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
      >

        bullet list
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
      >
        ordered list
      </button>
      <div className='divided'></div>

      <button onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        horizontal rule
      </button>
      <button onClick={() => editor.chain().focus().setHardBreak().run()}>
        hard break
      </button>
      <div className='divided'></div>

      <button onClick={() => editor.chain().focus().undo().run()}>
        undo
      </button>
      <button onClick={() => editor.chain().focus().redo().run()}>
        redo
      </button>

      <div className='divided'></div>

      <button onClick={setLink} className={editor.isActive('link') ? 'is-active' : ''}>
        setLink
      </button>
      <button
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
      >remove link</button>

      <div className='divided'></div>

      <button onClick={addImage}>setImage</button>
      <div className='divided'></div>

      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={editor.isActive('taskList') ? 'is-active' : ''}
      >
        toggleTaskList
      </button>
      <button
        onClick={() => editor.chain().focus().splitListItem('taskItem').run()}
        disabled={!editor.can().splitListItem('taskItem')}
      >
        splitListItem
      </button>
      <button
        onClick={() => editor.chain().focus().sinkListItem('taskItem').run()}
        disabled={!editor.can().sinkListItem('taskItem')}
      >
        sinkListItem
      </button>
      <button
        onClick={() => editor.chain().focus().liftListItem('taskItem').run()}
        disabled={!editor.can().liftListItem('taskItem')}
      >
        liftListItem
      </button>
      <div className='divided'></div>
      <button onClick={() => editor.chain().focus().unsetAllMarks().run()}>
        clear marks
      </button>
      <button onClick={() => editor.chain().focus().clearNodes().run()}>
        clear nodes
      </button>
    </div>





  )
}
const onUpdate = () => {
  // The content has changed.
}


const Tiptap = ({ padName, provider, ydoc }) => {
  const [isloading, setIsloading] = useState(true)


  const editor = useEditor({
    onCreate: (editor) => {
      console.log("onCreate", editor)
    },
    onUpdate: (editor) => {
      console.log("onUpdate", editor)
    },
    editorProps: {
      attributes: {
        spellcheck: 'false',
      },
    },
    extensions: [
      HeadingID,
      Link.configure({
        protocols: ['ftp', 'mailto'],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'image-class',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'tasks-class',
        },
      }),
      StarterKit.configure({
        // The Collaboration extension comes with its own history handling
        history: false,
      }),
      Highlight,
      Typography,
      // Register the document with Tiptap
      Collaboration.configure({
        document: provider.document,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: { name: 'John Doe', color: randomColor() },
      }),
    ],
    content: '',
  })

  useEffect(() => {
    // console.log("useEffect", editor)
    if (!editor) setIsloading(false)
    console.log("data loadedddd!!1")
    // console.log("useEffect", isloading)
    document.title = `Pad: ${ padName }`;
    return () => {
      editor?.destroy()
    }
  }, [editor])



  // editor?.on('update', onUpdate)

  return (


    <div className='tiptap'>
      <div className='sidebar'>
        {editor ? <TableOfContents editor={editor} /> : "loading----"}
      </div>
      <div className='editor'>
        {editor ? <MenuBar editor={editor} /> : "loading-----"}
        {editor ? <EditorContent editor={editor} /> : "loading------"}
      </div>
    </div>


  )
}

export default Tiptap
