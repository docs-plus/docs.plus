import './styles.scss'
import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import StarterKit from '@tiptap/starter-kit'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import HeadingID from './TableOfContents.jsx'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import randomColor from 'randomcolor'
// import Placeholder from '@tiptap/extension-placeholder'
// import Gapcursor from '@tiptap/extension-gapcursor'
// import Dropcursor from '@tiptap/extension-dropcursor'

import Underline from '@tiptap/extension-underline'

const onUpdate = () => {
  // The content has changed.
}


const Editor = ({ padName, provider, ydoc, defualtContent = '', spellcheck = false, children }) => {
  const [isloading, setIsloading] = useState(true)

  const editor = useEditor({
    onCreate: (editor) => {
      // console.log("onCreate", editor)
    },
    onUpdate: (editor) => {
      // console.log("onUpdate", editor)
    },
    editorProps: {
      attributes: {
        spellcheck,
      },
    },
    extensions: [
      HeadingID,
      Underline,
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
      // Gapcursor,
      // Dropcursor,
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
      Highlight,
      // Register the document with Tiptap
      Collaboration.configure({
        document: provider.document,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: { name: 'John Doe', color: randomColor() },
      }),
      // Placeholder.configure({
      //   placeholder: 'Write something …',
      // })
    ],
    defualtContent: '',
  }, [])

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

  return editor
}

export default Editor
