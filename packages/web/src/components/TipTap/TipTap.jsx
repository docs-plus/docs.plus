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
// import UniqueID from '@tiptap-pro/extension-unique-id'
import UniqueID from './extentions/UniqueId'

// import Headings from './extentions/Headings'
// import HeadingsTitle from './extentions/HeadingsTitle'
// import HeadingsContent from './extentions/HeadingsContent'
import Placeholder from '@tiptap/extension-placeholder'
import { ObjectID } from 'bson';
import headingAttrs from './TableOfContentss'
import Gapcursor from '@tiptap/extension-gapcursor'
import { isChangeOrigin } from '@tiptap/extension-collaboration'

import { Node } from '@tiptap/core'

// import Heading from '@tiptap/extension-heading'
// import Heading from './extentions/Heading'
import ContentWrapper from './extentions/ContentWrapper'
import ContentHeading from './extentions/ContentHeading'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
// import { findWrapping } from "prosemirror-transform"
import HardBreak from '@tiptap/extension-hard-break'
import Heading from './extentions/Heading'


import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import BulletList from '@tiptap/extension-bullet-list'
import Strike from '@tiptap/extension-strike'
// the underlying ProseMirror schema
// {
//   nodes: {
//     document: {
//       content: 'block+',
//     },
//     paragraph: {
//       content: 'inline*',
//         group: 'block',
//           parseDOM: [{ tag: 'p' }],
//             toDOM: () => ['p', 0],
//     },
//     text: {
//       group: 'inline',
//     },
//   },
// }

// const groupSchema = new Schema({
//   nodes: {
//     doc: { content: "block+" },
//     paragraph: { group: "block", content: "text*" },
//     blockquote: { group: "block", content: "block+" },
//     text: {}
//   }
// })


const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'heading+',
})

const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [
      { tag: 'p' },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0]
  },
})

const Button = Node.create({
  name: 'button',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [
      { tag: 'button' },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['button', mergeAttributes(HTMLAttributes), 0]
  },
})

const Text = Node.create({
  name: 'text',
  group: 'inline',
})


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
      Bold,
      Italic,
      BulletList,
      Strike,
      HardBreak,
      Gapcursor,
      Document,
      Paragraph,
      Text,
      ListItem,
      OrderedList,
      Heading.configure({
        persist: true,
      }),
      Button,

      // Note,
      // NoteGroup,
      ContentHeading,
      ContentWrapper,
      // Heading,
      // UniqueID.configure({
      //   types: ['heading', 'paragraph'],
      //   filterTransaction: transaction => !isChangeOrigin(transaction),
      //   // generateID: () => ObjectID()
      // }),

      // Such expressions can be combined to create a sequence,
      // for example "heading paragraph+" means ‘first a heading,
      // then one or more paragraphs’.
      // You can also use the pipe | operator to indicate a choice between two
      // expressions, as in "(paragraph | blockquote)+".



      // StarterKit.configure({
      //   // The Collaboration extension comes with its own history handling
      //   history: false,
      //   paragraph: {
      //     content: 'heading paragraph+'
      //   }
      // }),
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
      // //=======>>>

      // HeadingsTitle,
      // HeadingsContent,
      // Headings.configure({
      //   persist: true,
      //   open: true,
      //   HTMLAttributes: {
      //     class: 'headings drag_box',
      //   },
      // }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          const nodeType = node.type.name
          if (nodeType === 'contentHeading') {
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
      // headingAttrs,

    ],
    defualtContent: '',
  }, [])

  useEffect(() => {
    // console.log("useEffect", editor)
    if (!editor) setIsloading(false)
    // console.log("data loadedddd!!1")
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
