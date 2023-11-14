import { Node } from '@tiptap/core'
import randomColor from 'randomcolor'
import { createLowlight } from 'lowlight'
import ShortUniqueId from 'short-unique-id'
import ENUMS from './enums'

// Collaboration
import Collaboration, { isChangeOrigin } from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'

// Basic Formatting
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import TextAlign from '@tiptap/extension-text-align'

// Lists and Items
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import BulletList from '@tiptap/extension-bullet-list'

// Links and Media
import previewHyperlinkModal from './hyperlinkModals/previewHyperlink'
import setHyperlinks from './hyperlinkModals/setHyperlink'
import Hyperlink from '@docs.plus/extension-hyperlink'

// Code and Syntax Highlighting
import Highlight from '@tiptap/extension-highlight'
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

// Typography
import Typography from '@tiptap/extension-typography'
import Heading from './extentions/Heading'
import ContentHeading from './extentions/ContentHeading'

// Other Nodes and Extensions
import Blockquote from '@tiptap/extension-blockquote'
import Placeholder from '@tiptap/extension-placeholder'
import Gapcursor from '@tiptap/extension-gapcursor'
import UniqueID from './extentions/UniqueId'
import ContentWrapper from './extentions/ContentWrapper'
import HardBreak from '@tiptap/extension-hard-break'

// Table
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'

import {
  HyperMultimediaKit,
  imageModal,
  youtubeModal,
  vimeoModal,
  soundCloudModal,
  twitterModal,
} from "@docs.plus/extension-hypermultimedia";

import Placeholders from './placeholders'

const lowlight = createLowlight()
lowlight.register('html', html)
lowlight.register('css', css)
lowlight.register('js', js)
lowlight.register('ts', ts)
lowlight.register('markdown', md)
lowlight.register('python', python)
lowlight.register('yaml', yaml)
lowlight.register('json', json)
lowlight.register('bash', bash)

const Document = Node.create({
  name: ENUMS.NODES.DOC_TYPE,
  topNode: true,
  content: 'heading+'
})

const Paragraph = Node.create({
  name: ENUMS.NODES.PARAGRAPH_TYPE,
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0]
  }
})

const Text = Node.create({
  name: ENUMS.NODES.TEXT_TYPE,
  group: 'inline'
})

const scrollDown = () => {
  const url = new URL(window.location)
  const id = url.searchParams.get('id')

  if (!id) return
  setTimeout(() => {
    document.querySelector(`[data-id="${url.searchParams.get('id')}"]`)?.scrollIntoView()
  }, 200)
}

const generatePlaceholderText = (data) => {
  const { node } = data
  const nodeType = node.type.name
  if (!data.editor.isFocused) return null

  if (nodeType === ENUMS.NODES.CONTENT_HEADING_TYPE || nodeType === ENUMS.NODES.HEADING_TYPE) {
    const level = node.attrs.level
    return level - 1 === 0 ? 'Title' : `Heading ${level - 1}`
  } else if (nodeType === ENUMS.NODES.PARAGRAPH_TYPE) {
    const msg = Placeholders

    const { $head } = data.editor.view.state.selection

    const headingPath = $head.path
      .filter((x) => x?.type?.name === ENUMS.NODES.HEADING_TYPE)
      .map((x) => x.firstChild.textContent)

    // `${headingPath.join(' / ')}: ${msg[Math.floor(Math.random() * msg.length + 1)]}`
    return `${headingPath.join(' / ')}`
  }

  return null
}

const Editor = ({ provider, spellcheck = false }) => {
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

  const CollaborationCursorConfig = {
    provider,
    user: {
      name: 'Adam Doe',
      color: randomColor()
    }
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    CollaborationCursorConfig.user.name = 'Unknown User'
    CollaborationCursorConfig.render = (user) => {
      const cursor = document.createElement('span')
      cursor.classList.add('collaboration-cursor__caret')
      cursor.setAttribute('style', `border-color: ${user.color};`)

      // create a dive to display user avatar
      const avatar = document.createElement('div')
      avatar.classList.add('collaboration-cursor__avatar')
      avatar.setAttribute(
        'style',
        `background-image: url(${user.avatar}); background-color:#ddd; border-color: ${user.color};`
      )

      const label = document.createElement('div')
      label.classList.add('collaboration-cursor__label')
      label.setAttribute('style', `background-color: ${user.color}`)
      label.insertBefore(document.createTextNode(user.name), null)
      cursor.insertBefore(label, null)
      if (user.avatar) cursor.insertBefore(avatar, null)
      return cursor
    }
  }

  return {
    onCreate: () => {
      scrollDown()
    },
    editorProps: {
      attributes: {
        spellcheck
      }
    },
    extensions: [
      UniqueID.configure({
        types: [ENUMS.NODES.HEADING_TYPE, ENUMS.NODES.HYPERLINK_TYPE],
        filterTransaction: (transaction) => !isChangeOrigin(transaction),
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
      Hyperlink.configure({
        protocols: ['ftp', 'mailto'],
        hyperlinkOnPaste: false,
        modals: {
          previewHyperlink: (data) => {
            return previewHyperlinkModal(data)
          },
          setHyperlink: (data) => {
            return setHyperlinks(data)
          }
        }
      }),
      HyperMultimediaKit.configure({
        Image: {
          modal: imageModal,
          inline: true
        },
        Video: {
          modal: youtubeModal,
          inline: true
        },
        Audio: {
          modal: twitterModal,
          inline: true
        },
        Youtube: {
          modal: youtubeModal,
          inline: true
        },
        Vimeo: {
          modal: vimeoModal,
          inline: true
        },
        SoundCloud: {
          modal: soundCloudModal,
          inline: true
        },
        Twitter: {
          modal: twitterModal,
          inline: true
        },
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
      CollaborationCursor.configure(CollaborationCursorConfig),
      Placeholder.configure({
        includeChildren: true,
        placeholder: generatePlaceholderText
      })
    ],
    defualtContent: ''
  }
}

export default Editor
