import Config from '@config'
import { createHyperlinkPopover, Hyperlink } from '@docs.plus/extension-hyperlink'
// import {
//   // HyperMultimediaKit,
//   imageModal as _imageModal,
//   soundCloudModal as _soundCloudModal,
//   twitterModal as _twitterModal,
//   vimeoModal as _vimeoModal,
//   youtubeModal as _youtubeModal
// } from '@docs.plus/extension-hypermultimedia'
import { Indent } from '@docs.plus/extension-indent'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { Placeholder, type PlaceholderRenderProps } from '@docs.plus/extension-placeholder'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { authStore } from '@stores'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Collaboration, isChangeOrigin } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { UniqueID } from '@tiptap/extension-unique-id'
import { UndoRedo } from '@tiptap/extensions'
import { Markdown } from '@tiptap/markdown'
import { UseEditorOptions } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TIPTAP_NODES, type Transaction } from '@types'
import { scrollElementInMobilePadEditor } from '@utils/scrollMobilePadEditor'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import js from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import md from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import ts from 'highlight.js/lib/languages/typescript'
import html from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { createLowlight } from 'lowlight'
import randomColor from 'randomcolor'
import ShortUniqueId from 'short-unique-id'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'

import { HeadingFilter } from './extensions/heading-filter'
import { HeadingFold, headingFoldPluginKey } from './extensions/heading-fold'
import { HeadingScale } from './extensions/heading-scale'
import { HeadingActionsExtension } from './extensions/HeadingActions'
import {
  HighlightWithMarkdown,
  // Kept as a roll-back hatch for the legacy markdown-link path; flip the
  // import name back to `HyperlinkWithMarkdown` and swap it into `extensions`
  // below if the new mobile sheet pipeline regresses.
  HyperlinkWithMarkdown as _HyperlinkWithMarkdown
  // ImageWithMarkdown
} from './extensions/markdown-extensions'
import { MarkdownPaste } from './extensions/markdown-paste'
import { ParagraphStyle } from './extensions/paragraph-style'
import { TitleDocument } from './extensions/title-document'
import createHyperlinkMobile from './hyperlinkPopovers/createHyperlink'
import previewHyperlink from './hyperlinkPopovers/previewHyperlink'
// import MediaUploadPlaceholder from './nodes/MediaUploadPlaceholder'
import { IOSCaretFix } from './plugins/iosCaretFixPlugin'

const headingTableUid = new ShortUniqueId()

const lowlight = createLowlight()
type LowlightLanguage = Parameters<typeof lowlight.register>[1]
lowlight.register('html', html)
lowlight.register('css', css)
lowlight.register('js', js)
lowlight.register('ts', ts)
lowlight.register('markdown', md)
lowlight.register('python', python as unknown as LowlightLanguage)
lowlight.register('yaml', yaml)
lowlight.register('json', json)
lowlight.register('bash', bash as unknown as LowlightLanguage)

const scrollDown = () => {
  const url = new URL(window.location.href)
  const id = url.searchParams.get('id')

  if (!id) return
  setTimeout(() => {
    const el = document.querySelector(`[data-toc-id="${id}"]`)
    if (!el) return
    if (!scrollElementInMobilePadEditor(el, { block: 'nearest', behavior: 'auto' })) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    }
  }, 200)
}

const PLACEHOLDER_TEXT: Record<string, string> = {
  heading: 'Heading',
  paragraph: 'Type something…',
  codeBlock: 'Write code…'
}

const PARENT_PLACEHOLDER: Record<string, string> = {
  listItem: 'List',
  taskItem: 'To-do',
  blockquote: 'Quote'
}

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

  const baseExtensions = [
    StarterKit.configure({
      document: false,
      undoRedo: false,
      paragraph: false,
      heading: {
        levels: [1, 2, 3, 4, 5, 6]
      },
      codeBlock: false
    }),

    ParagraphStyle,

    // Task lists live in @tiptap/extension-list (not StarterKit). Required for toggleTaskList / taskList schema.
    TaskList,
    TaskItem.configure({
      nested: true
    }),

    Markdown.configure({
      markedOptions: {
        tokenizer: { html: () => undefined }
      } as Record<string, unknown>
    }),

    TitleDocument,

    UniqueID.configure({
      attributeName: 'toc-id',
      types: [TIPTAP_NODES.HEADING_TYPE, TIPTAP_NODES.HYPERLINK_TYPE, TIPTAP_NODES.TABLE_TYPE],
      filterTransaction: (transaction: Transaction) => !isChangeOrigin(transaction),
      generateID: () => headingTableUid.stamp(16)
    }),

    HeadingScale,
    HeadingFold.configure({
      documentId: docName
    }),
    HeadingFilter.configure({
      foldAdapter: {
        getFoldedIds: (state) => {
          return headingFoldPluginKey.getState(state)?.foldedIds ?? new Set<string>()
        },
        setTemporaryFolds: (tr, ids) => {
          tr.setMeta(headingFoldPluginKey, { type: 'set', ids, persist: false })
          return tr
        },
        restoreFolds: (tr, savedIds) => {
          tr.setMeta(headingFoldPluginKey, { type: 'set', ids: savedIds, persist: true })
          return tr
        }
      }
    }),

    Indent.configure({
      indentChars: '\t',
      allowedIndentContexts: [
        { textblock: 'paragraph', parent: 'doc' },
        { textblock: 'paragraph', parent: 'blockquote' },
        { textblock: 'heading', parent: 'doc' }
      ]
    }),
    CodeBlockLowlight.configure({
      lowlight
    }),
    InlineCode,
    Superscript,
    Subscript,
    TextAlign,
    HeadingActionsExtension.configure({
      // Read-only (e.g. version history): no heading chat/comment affordances
      hoverChat: editable,
      selectionChat: editable && !isMobile
    }),
    Hyperlink.configure({
      protocols: ['ftp', 'mailto'],
      linkOnPaste: false,
      autolink: true,
      popovers: {
        previewHyperlink,
        createHyperlink: isMobile ? createHyperlinkMobile : createHyperlinkPopover
      }
    }),
    // HyperMultimediaKit.configure({
    //   Image: false
    // }),
    // ImageWithMarkdown.configure({
    //   inline: true,
    //   allowBase64: true
    // }),
    // MediaUploadPlaceholder,
    MarkdownPaste,
    HighlightWithMarkdown,
    Typography,
    Table.configure({
      resizable: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    // Why not @tiptap/extensions Placeholder?
    // The built-in uses doc.descendants() — O(N) on every transaction.
    // @docs.plus/extension-placeholder uses state.init/apply with cursor-only
    // checks — O(1) for the common typing case. Critical for large collab docs.
    Placeholder.configure({
      placeholder: ({ node, pos, parentName }: PlaceholderRenderProps) => {
        if (node.type.name === 'heading' && pos === 0) return 'Enter document name'
        if (
          node.type.name === 'paragraph' &&
          (node.attrs as { paragraphStyle?: string | null }).paragraphStyle === 'subtitle'
        ) {
          return 'Subtitle'
        }
        if (node.type.name === 'paragraph' && parentName in PARENT_PLACEHOLDER) {
          return PARENT_PLACEHOLDER[parentName]
        }
        return PLACEHOLDER_TEXT[node.type.name] ?? ''
      }
    }),
    IOSCaretFix
  ]

  if (!provider) {
    const extensions = [
      ...baseExtensions,
      UndoRedo.configure({
        depth: 5
      })
    ]

    const canUseIndexedDb = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'

    if (localPersistence && docName && canUseIndexedDb) {
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
      shouldRerenderOnTransaction: false,
      editable,
      extensions
    }
  }

  const CollaborationCaretConfig = getCollaborationCaretConfig(provider)

  return {
    onCreate: scrollDown,
    enableContentCheck: true,
    onContentError({ error }) {
      console.error('onContentError', error)
    },
    editorProps: {
      attributes: {
        spellcheck: spellcheck.toString()
      }
    },
    immediatelyRender: false,
    // Keep false: true re-renders the whole `useEditor` host (e.g. document layout) every keystroke.
    // Toolbars use `useReRenderOnEditorTransaction` for `isActive` / marks.
    shouldRerenderOnTransaction: false,
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

const getCollaborationCaretConfig = (provider: HocuspocusProvider) => {
  const profile = authStore.getState().profile
  const user = {
    name: profile?.display_name || profile?.username || profile?.email || 'anonymous',
    id: profile?.id || profile?.email || 'anonymous',
    color: randomColor({ luminosity: 'light' }),
    avatarUpdatedAt: profile?.avatar_updated_at || null,
    avatarUrl: profile?.avatar_url || null
  }

  interface CollaborationCaretUser {
    color: string
    id: string
    name: string
    avatarUpdatedAt?: string | null
    avatarUrl?: string | null
  }

  return {
    provider,
    user,
    render: (caretUser: CollaborationCaretUser): HTMLElement => {
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
        `background-image: url(${avatarAddress}); background-color: var(--color-base-300); border-color: ${caretUser.color};`
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
