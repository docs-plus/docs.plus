import './styles/styles.scss'
import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Collaboration, { isChangeOrigin } from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import randomColor from 'randomcolor'
import Underline from '@tiptap/extension-underline'

import Placeholder from '@tiptap/extension-placeholder'
import Gapcursor from '@tiptap/extension-gapcursor'
import { Node } from '@tiptap/core'

import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import HardBreak from '@tiptap/extension-hard-break'

import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import BulletList from '@tiptap/extension-bullet-list'
import Strike from '@tiptap/extension-strike'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Blockquote from '@tiptap/extension-blockquote'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import css from 'highlight.js/lib/languages/css'
import js from 'highlight.js/lib/languages/javascript'
import ts from 'highlight.js/lib/languages/typescript'
import html from 'highlight.js/lib/languages/xml'
import md from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
// load all highlight.js languages
import { lowlight } from 'lowlight'
import ShortUniqueId from 'short-unique-id'
// Table Node Block
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'

import Heading from './extentions/Heading'
import ContentHeading from './extentions/ContentHeading'
import UniqueID from './extentions/UniqueId'
import ContentWrapper from './extentions/ContentWrapper'

lowlight.registerLanguage('html', html)
lowlight.registerLanguage('css', css)
lowlight.registerLanguage('js', js)
lowlight.registerLanguage('ts', ts)
lowlight.registerLanguage('markdown', md)
lowlight.registerLanguage('python', python)
lowlight.registerLanguage('yaml', yaml)
lowlight.registerLanguage('json', json)
lowlight.registerLanguage('bash', bash)

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'heading+'
})

const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML () {
    return [
      { tag: 'p' }
    ]
  },
  renderHTML ({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0]
  }
})

const Text = Node.create({
  name: 'text',
  group: 'inline'
})

const scrollDown = () => {
  const url = new URL(window.location)
  const id = url.searchParams.get('id')

  if (!id) return
  setTimeout(() => {
    console.log({
      do: document.querySelector('.tipta__editor'),
      param: url,
      id: url.searchParams.get('id'),
      nodeTarget: document.querySelector(`[data-id="${url.searchParams.get('id')}"]`)
    })
    document.querySelector(`[data-id="${url.searchParams.get('id')}"]`)?.scrollIntoView()
  }, 200)
}

const Editor = ({ padName, provider, ydoc, defualtContent = '', spellcheck = false, children }) => {
  if (!provider) {
    return {
      extensions: [
        Document,
        Bold,
        Italic,
        BulletList,
        Strike,
        HardBreak,
        Gapcursor,
        Paragraph,
        Text,
        ListItem,
        OrderedList,
        Heading.configure(),
        ContentHeading,
        ContentWrapper
      ]
    }
  }

  return {
    onCreate: (editor) => {
      // console.log("onCreate", editor)
      scrollDown()
    },
    onUpdate: (editor) => {
      // console.log("onUpdate", editor)
    },
    editorProps: {
      attributes: {
        spellcheck
      }
    },
    extensions: [
      UniqueID.configure({
        types: ['heading', 'link'],
        filterTransaction: transaction => !isChangeOrigin(transaction),
        generateID: () => {
          const uid = new ShortUniqueId()

          return uid.stamp(16)
        }
      }),
      Document,
      Bold,
      Italic,
      BulletList,
      Strike,
      HardBreak,
      Gapcursor,
      Paragraph,
      Text,
      ListItem,
      OrderedList,
      Heading.configure(),
      CodeBlockLowlight.configure({
        lowlight
      }),
      ContentHeading,
      ContentWrapper,
      Superscript,
      Subscript,
      Blockquote,
      TextAlign,
      Underline,
      Link.configure({
        protocols: ['ftp', 'mailto']
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'image-class'
        }
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'tasks-class'
        }
      }),
      Highlight,
      Typography,
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Collaboration.configure({
        document: provider.document
      }),
      CollaborationCursor.configure({
        provider,
        user: { name: 'Adam Doe', color: randomColor() }
      }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          const nodeType = node.type.name

          if (nodeType === 'contentHeading') {
            const level = node.attrs.level

            return level - 1 === 0 ? 'Title' : `Heading ${level - 1}`
          } else if (nodeType === 'heading') {
            const level = node.attrs.level

            return level - 1 === 0 ? 'Title' : `Heading ${level - 1}`
          } else if (nodeType === 'paragraph') {
            const msg = [
              'Type your thoughts here ...',
              'Start your writing here ...',
              "What's on your mind? ...",
              'Let your words flow ...',
              'Unleash your creativity ...',
              'Your text here ...',
              'Express yourself ...',
              'Write your ideas down ...',
              'Share your thoughts ...',
              'Start typing ...',
              'Begin typing here ...',
              'Jot down your ideas here ...',
              'Let your imagination run wild ...',
              'Capture your thoughts ...',
              'Brainstorm your next masterpiece ...',
              'Put your ideas into words ...',
              'Express your creativity ...',
              'Create something amazing ...',
              'Write down your musings ...',
              'Craft your unique story ...',
              'Unleash your inner writer ...',
              'Share your innovative ideas ...',
              'Pen your next big idea ...',
              'Write from the heart ...',
              'Manifest your creativity here ...',
              'Share your brilliant insights ...',
              'Craft your vision ...',
              'Distill your thoughts into words ...',
              'Let your inspiration flow ...',
              'Pen your creative masterpiece ...',
              'Draft your imaginative ideas here ...',
              'Bring your imagination to life ...',
              'Write your way to clarity ...',
              'Craft your next big breakthrough ...',
              'Let your ideas take shape ...',
              'Create your own narrative ...',
              'Put your originality on paper ...',
              'Express your unique perspective ...',
              'Inscribe your original thoughts ...',
              'Unfold your creative potential ...',
              'Give voice to your ideas ...',
              'Paint a picture with your words ...',
              'Sculpt your ideas into sentences ...',
              'Design your masterpiece with words ...',
              'Shape your vision with language ...',
              'Craft your story with care ...',
              'Compose your narrative with passion ...',
              'Build your message from scratch ...',
              'Develop your concepts with clarity ...',
              'Forge your ideas into a cohesive whole ...',
              'Carve out your ideas with precision ...'
            ]

            return msg[Math.floor(Math.random() * msg.length + 1)]
          }

          return null
        }
      })
    ],
    defualtContent: ''
  }
}

export default Editor
