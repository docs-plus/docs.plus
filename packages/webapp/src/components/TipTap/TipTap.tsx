import { UseEditorOptions } from '@tiptap/react'
import randomColor from 'randomcolor'
import { createLowlight } from 'lowlight'
import ShortUniqueId from 'short-unique-id'
import {
  TIPTAP_NODES,
  type ProseMirrorNode,
  type Editor as TipTapEditor,
  type Transaction
} from '@types'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { authStore } from '@stores'
import Config from '@config'

// CustomNodes
import Document from './nodes/Document'
import Paragraph from './nodes/Paragraph'
import Text from './nodes/Text'
import Heading from './nodes/Heading'
import ContentHeading from './nodes/ContentHeading'
import ContentWrapper from './nodes/ContentWrapper'

// Collaboration
import { Collaboration, isChangeOrigin } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'

// Basic Formatting
import { Bold } from '@tiptap/extension-bold'
import { Italic } from '@tiptap/extension-italic'
import { Underline } from '@tiptap/extension-underline'
import { Strike } from '@tiptap/extension-strike'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'
import { TextAlign } from '@tiptap/extension-text-align'

// Lists and Items
import { BulletList, ListItem, OrderedList, TaskItem, TaskList } from '@tiptap/extension-list'

// Links and Media
// import previewHyperlinkModal from './hyperlinkModals/previewHyperlink'
// import setHyperlinks from './hyperlinkModals/setHyperlink'
import { createHyperlinkPopover, Hyperlink } from '@docs.plus/extension-hyperlink'
import previewHyperlink from './hyperlinkPopovers/previewHyperlink'

// Code and Syntax Highlighting
import { Highlight } from '@tiptap/extension-highlight'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
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
import { Typography } from '@tiptap/extension-typography'

// Other Nodes and Extensions
import { Blockquote } from '@tiptap/extension-blockquote'
import { Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions'
import { UniqueID } from '@tiptap/extension-unique-id'
import { HardBreak } from '@tiptap/extension-hard-break'

// Table
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

import { Indent } from '@docs.plus/extension-indent'

import ChatCommentExtension from './extentions/ChatCommentExtension'
import { IOSCaretFix } from './plugins/iosCaretFixPlugin'

import { InlineCode } from '@docs.plus/extension-inline-code'
import {
  HyperMultimediaKit,
  imageModal,
  youtubeModal,
  vimeoModal,
  soundCloudModal,
  twitterModal
} from '@docs.plus/extension-hypermultimedia'
// import Placeholders from './placeholders'
// import { Placeholder } from './Placeholder'
import MediaUploadPlaceholder from './nodes/MediaUploadPlaceholder'

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

const lowlight = createLowlight()
lowlight.register('html', html)
lowlight.register('css', css)
lowlight.register('js', js)
lowlight.register('ts', ts)
lowlight.register('markdown', md)
lowlight.register('python', python as any)
lowlight.register('yaml', yaml)
lowlight.register('json', json)
lowlight.register('bash', bash as any)

const scrollDown = () => {
  const url = new URL(window.location.href)
  const id = url.searchParams.get('id')

  if (!id) return
  setTimeout(() => {
    document.querySelector(`[data-id="${url.searchParams.get('id')}"]`)?.scrollIntoView(true)
  }, 200)
}

interface PlaceholderData {
  node: ProseMirrorNode
  editor: TipTapEditor
}

const generatePlaceholderText = (data: PlaceholderData): string | null => {
  const { node, editor } = data
  const nodeType = node.type.name
  if (!editor.isFocused) return null

  if (nodeType === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    const level = node.attrs.level
    return `Heading ${level}`
  } else if (nodeType === TIPTAP_NODES.PARAGRAPH_TYPE) {
    const { $head } = editor.view.state.selection

    // Access internal 'path' property of ResolvedPos for heading breadcrumb
    const headingPath = ($head as unknown as { path: ProseMirrorNode[] }).path
      .filter((x: ProseMirrorNode) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
      .map((x: ProseMirrorNode) => x.firstChild?.textContent)

    return `${headingPath.join(' / ')}`
  }

  return null
}

// TODO: editor extensions should be dynamic
const Editor = ({
  provider,
  spellcheck = false,
  editable = true,
  localPersistence = false,
  docName = 'example-document'
}: {
  provider?: HocuspocusProvider | null
  spellcheck?: boolean
  editable?: boolean
  localPersistence?: boolean
  docName?: string
}): Partial<UseEditorOptions> => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore.getState()

  // Base extensions that don't require provider
  const baseExtensions = [
    UniqueID.configure({
      types: [TIPTAP_NODES.HEADING_TYPE, TIPTAP_NODES.HYPERLINK_TYPE],
      filterTransaction: (transaction: Transaction) => !isChangeOrigin(transaction),
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
    Indent.configure({
      indentChars: '\t',
      enabled: true
    }),
    ListItem,
    OrderedList,
    Heading.configure(),
    CodeBlockLowlight.configure({
      lowlight
    }),
    InlineCode,
    ContentHeading,
    ContentWrapper,
    Superscript,
    Subscript,
    Blockquote,
    TextAlign,
    Underline,
    ...(isMobile ? [] : [ChatCommentExtension]),
    Hyperlink.configure({
      protocols: ['ftp', 'mailto'],
      hyperlinkOnPaste: false,
      autoHyperlink: true,
      popovers: {
        previewHyperlink: previewHyperlink,
        createHyperlink: createHyperlinkPopover
      }
    }),
    HyperMultimediaKit.configure({
      Image: {
        inline: true,
        allowBase64: true
      }
    }),
    MediaUploadPlaceholder,
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
    Placeholder.configure({
      includeChildren: true,
      showOnlyWhenEditable: false,
      placeholder: (data: PlaceholderData) => generatePlaceholderText(data) || ''
    }),
    // iOS Safari: Fix caret positioning when tapping in middle of words
    IOSCaretFix
  ]

  if (!provider) {
    // Create local persistence if enabled
    const extensions = [
      ...baseExtensions,
      UndoRedo.configure({
        depth: 5
      })
    ]

    if (localPersistence && docName) {
      const ydoc = new Y.Doc()
      new IndexeddbPersistence(docName, ydoc)

      extensions.push(
        Collaboration.configure({
          document: ydoc
        })
      )
    }

    return {
      editorProps: {
        attributes: {
          spellcheck: spellcheck.toString()
        }
      },
      immediatelyRender: false,
      editable,
      extensions
    }
  }

  // Configure collaboration caret when provider exists
  const CollaborationCaretConfig = getCollaborationCaretConfig(provider)

  return {
    onCreate: scrollDown,
    enableContentCheck: true,
    onContentError({ editor, error, disableCollaboration }) {
      console.error('onContentError', error)
    },
    editorProps: {
      attributes: {
        spellcheck: spellcheck.toString()
      }
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable,
    extensions: [
      ...baseExtensions,

      Collaboration.configure({
        document: provider.document
      }),
      CollaborationCaret.configure(CollaborationCaretConfig)
    ]
  }
}

// Helper function to get collaboration caret config
const getCollaborationCaretConfig = (provider: HocuspocusProvider) => {
  const profile = authStore.getState().profile
  const user = {
    name: profile?.display_name || profile?.username || profile?.email || 'anonymous',
    id: profile?.id || profile?.email || 'anonymous',
    color: randomColor({ luminosity: 'light' }),
    avatarUpdatedAt: profile?.avatar_updated_at || null,
    avatarUrl: profile?.avatar_url || null
  }

  return {
    provider,
    user,
    render: (caretUser: Record<string, any>): HTMLElement => {
      const cursor = document.createElement('span')
      cursor.classList.add('collaboration-cursor__caret')
      cursor.setAttribute('style', `border-color: ${caretUser.color};`)

      const avatarAddress = caretUser.avatarUpdatedAt
        ? Config.app.profile.getAvatarURL(caretUser.id, caretUser.avatarUpdatedAt)
        : caretUser.avatarUrl

      const avatar = document.createElement('div')
      avatar.classList.add('collaboration-cursor__avatar')
      avatar.setAttribute(
        'style',
        `background-image: url(${avatarAddress}); background-color:#ddd; border-color: ${caretUser.color};`
      )

      const label = document.createElement('div')
      label.classList.add('collaboration-cursor__label')
      label.setAttribute('style', `background-color: ${caretUser.color}`)
      label.insertBefore(document.createTextNode(caretUser.name), null)
      cursor.insertBefore(label, null)
      if (avatarAddress) cursor.insertBefore(avatar, null)
      return cursor
    }
  }
}

export default Editor
