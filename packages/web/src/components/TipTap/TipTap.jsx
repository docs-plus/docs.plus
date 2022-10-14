import './styles.scss'
import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import StarterKit from '@tiptap/starter-kit'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import randomColor from 'randomcolor'
import Underline from '@tiptap/extension-underline'
import UniqueID from '@tiptap-pro/extension-unique-id'

import Headings from './extentions/Headings'
import HeadingsTitle from './extentions/HeadingsTitle'
import HeadingsContent from './extentions/HeadingsContent'
import Placeholder from '@tiptap/extension-placeholder'
import { ObjectID } from 'bson';


import { isChangeOrigin } from '@tiptap/extension-collaboration'



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
      UniqueID.configure({
        types: ['heading', 'paragraph', 'placeholder', 'headings', 'headingsTitle', 'headingsContent', 'details'],
        filterTransaction: transaction => !isChangeOrigin(transaction),
        // generateID: () => ObjectID()
      }),
      StarterKit.configure({
        // The Collaboration extension comes with its own history handling
        history: false,
      }),
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
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'tasks-class',
        },
      }),
      Highlight,
      Typography,

      Collaboration.configure({
        document: provider.document,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: { name: 'John Doe', color: randomColor() },
      }),
      //=======>>>

      HeadingsTitle,
      HeadingsContent,
      Headings.configure({
        persist: true,
        open: true,
        HTMLAttributes: {
          class: 'headings drag_box',
        },
      }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          const nodeType = node.type.name
          if (nodeType === 'headingsTitle') {
            const level = node.attrs.level
            return level - 1 === 0 ? "Title" : `Heading ${ level - 1 }`
          } else if (nodeType === 'heading') {
            const level = node.attrs.level
            return level - 1 === 0 ? "Title" : `Heading ${ level - 1 }`
          }
          else if (nodeType === 'paragraph') {
            return 'Write something …';
          }

          return null

        },
      }),
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
