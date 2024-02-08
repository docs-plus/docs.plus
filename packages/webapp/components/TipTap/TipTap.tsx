import { EditorOptions, Node } from '@tiptap/core'
import randomColor from 'randomcolor'
import { createLowlight } from 'lowlight'
import ShortUniqueId from 'short-unique-id'
import ENUMS from './enums'

// Collaboration
import Collaboration, { isChangeOrigin } from '@tiptap/extension-collaboration'
import CollaborationCursor, {
  CollaborationCursorOptions
} from '@tiptap/extension-collaboration-cursor'

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
  twitterModal
} from '@docs.plus/extension-hypermultimedia'
// import Placeholders from './placeholders'

const lowlight = createLowlight()
lowlight.register('html', html)
lowlight.register('css', css)
lowlight.register('js', js)
lowlight.register('ts', ts)
lowlight.register('markdown', md)
// lowlight.register('python', python)
lowlight.register('yaml', yaml)
lowlight.register('json', json)
// lowlight.register('bash', bash)

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
  const url = new URL(window.location.href)
  const id = url.searchParams.get('id')

  if (!id) return
  setTimeout(() => {
    document.querySelector(`[data-id="${url.searchParams.get('id')}"]`)?.scrollIntoView()
  }, 200)
}

const generatePlaceholderText = (data: any) => {
  const { node } = data
  const nodeType = node.type.name
  if (!data.editor.isFocused) return null

  if (nodeType === ENUMS.NODES.CONTENT_HEADING_TYPE || nodeType === ENUMS.NODES.HEADING_TYPE) {
    const level = node.attrs.level
    return level - 1 === 0 ? 'Title' : `Heading ${level - 1}`
  } else if (nodeType === ENUMS.NODES.PARAGRAPH_TYPE) {
    // const msg = Placeholders

    const { $head } = data.editor.view.state.selection

    const headingPath = $head.path
      .filter((x: any) => x?.type?.name === ENUMS.NODES.HEADING_TYPE)
      .map((x: any) => x.firstChild.textContent)

    // `${headingPath.join(' / ')}: ${msg[Math.floor(Math.random() * msg.length + 1)]}`
    return `${headingPath.join(' / ')}`
  }

  return null
}

const Editor = ({ provider, ydoc, spellcheck = false, user }: any): Partial<EditorOptions> => {
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
      name: 'anonymous',
      color: randomColor()
    }
  } as unknown as CollaborationCursorOptions

  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const newUser = {
      display_name: user?.display_name || user?.username || user?.email || 'anonymous',
      id: user?.id || user?.email || 'anonymous',
      color: randomColor()
    }

    CollaborationCursorConfig.user = newUser
    CollaborationCursorConfig.render = (user: Record<string, any>): HTMLElement => {
      const cursor = document.createElement('span')
      cursor.classList.add('collaboration-cursor__caret')
      cursor.setAttribute('style', `border-color: ${user.color};`)

      // create a dive to display user avatar
      const avatar = document.createElement('div')
      avatar.classList.add('collaboration-cursor__avatar')
      avatar.setAttribute(
        'style',
        `background-image: url(${user.avatar_url}); background-color:#ddd; border-color: ${user.color};`
      )

      const label = document.createElement('div')
      label.classList.add('collaboration-cursor__label')
      label.setAttribute('style', `background-color: ${user.color}`)
      label.insertBefore(document.createTextNode(user.name), null)
      cursor.insertBefore(label, null)
      if (user.avatar_url) cursor.insertBefore(avatar, null)
      return cursor
    }
  }

  return {
    onCreate: () => {
      scrollDown()
      // console.log('onCreate')
    },
    onUpdate: () => {
      // console.log('onUpdate')
    },
    editorProps: {
      attributes: {
        spellcheck
      }
    },
    extensions: [
      UniqueID.configure({
        types: [ENUMS.NODES.HEADING_TYPE, ENUMS.NODES.HYPERLINK_TYPE],
        filterTransaction: (transaction: any) => !isChangeOrigin(transaction),
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
          previewHyperlink: (data: any) => {
            return previewHyperlinkModal(data)
          },
          setHyperlink: (data: any) => {
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
        // document: ydoc
      }),
      CollaborationCursor.configure(CollaborationCursorConfig),
      Placeholder.configure({
        includeChildren: true,
        placeholder: (data: any) => generatePlaceholderText(data) || ''
      })
    ]
  }
}

export default Editor
