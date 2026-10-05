import Config from '@config'
import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { HyperMultimediaKit, isMediaUrl } from '@docs.plus/extension-hypermultimedia'
import { Indent } from '@docs.plus/extension-indent'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { Placeholder } from '@docs.plus/extension-placeholder'
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
import { type CaretUser, getCursorUser } from '@utils/getCursorUser'
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
import ShortUniqueId from 'short-unique-id'
import * as Y from 'yjs'

import { ClearFormatting } from './clearFormatting'
import { CaretFind, foldedIdsIncludingFind } from './extensions/caret-find'
import { HeadingFilter } from './extensions/heading-filter'
import { HeadingFold, type HeadingFoldMeta, headingFoldPluginKey } from './extensions/heading-fold'
import { HeadingScale } from './extensions/heading-scale'
import { HeadingActionsExtension } from './extensions/HeadingActions'
import { Highlight } from './extensions/highlight'
import { MarkdownPaste } from './extensions/markdown-paste'
import { ParagraphStyle } from './extensions/paragraph-style'
import { SlashMenu } from './extensions/slash-menu'
import { TitleDocument } from './extensions/title-document'
import { getHyperlinkPopoverConfig } from './hyperlinkPopovers/getHyperlinkPopoverConfig'
import { ListGapJoin } from './listGapJoin'
import { ListKeymapWithoutTab } from './listKeymapWithoutTab'
import { getMediaToolbarFactory } from './mediaPopovers/getMediaToolbarFactory'
import { getMediaActionsResolver } from './mediaPopovers/mediaComment'
import { createLucideToolbarIcons } from './mediaPopovers/mediaToolbarLucide'
import MediaUploadPlaceholder from './nodes/MediaUploadPlaceholder'
import { buildBreadcrumbPlaceholder } from './placeholders'
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

const Editor = ({
  provider,
  spellcheck = false,
  editable = true,
  localYdoc,
  docName = 'example-document'
}: {
  provider?: HocuspocusProvider | null
  spellcheck?: boolean
  editable?: boolean
  localYdoc?: Y.Doc
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
      codeBlock: false,
      // Not `link: false` (the composer's choice): stored pad docs contain
      // `link` marks that must stay schema-valid under enableContentCheck.
      // Hyperlink owns all <a> behavior, so Link stays registered but inert:
      // shouldAutoLink:false neuters its paste rule (autolink/linkOnPaste don't).
      link: {
        autolink: false,
        linkOnPaste: false,
        openOnClick: false,
        shouldAutoLink: () => false
      },
      // 3.30+ ListKeymap Tab sinks a following paragraph into the previous list.
      // Indent owns Tab. StarterKit's copy is replaced below.
      listKeymap: false
    }),
    ListKeymapWithoutTab,
    ListGapJoin,
    ClearFormatting,

    ParagraphStyle,

    // Task lists live in @tiptap/extension-list (not StarterKit). Required for toggleTaskList / taskList schema.
    TaskList,
    TaskItem.configure({
      nested: true
    }),

    Markdown,

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
        getFoldedIds: foldedIdsIncludingFind,
        setTemporaryFolds: (tr, ids) => {
          tr.setMeta(headingFoldPluginKey, {
            type: 'set',
            ids,
            persist: false
          } satisfies HeadingFoldMeta)
          return tr
        },
        restoreFolds: (tr, savedIds) => {
          tr.setMeta(headingFoldPluginKey, {
            type: 'set',
            ids: savedIds,
            persist: true
          } satisfies HeadingFoldMeta)
          return tr
        }
      }
    }),
    CaretFind,

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
    // InlineCode (priority 101) wins backtick input + Mod-e over StarterKit's
    // `code` mark; `code` stays enabled so existing collab docs keep their marks.
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
      exitable: true,
      // Yield media-provider URLs to hypermultimedia's paste-rules so a pasted
      // YouTube/Vimeo/SoundCloud/X/image link becomes an embed node, not a link.
      shouldAutoLink: (url: string) => !isMediaUrl(url),
      popovers: getHyperlinkPopoverConfig(isMobile)
    }),
    HyperMultimediaKit.configure({
      Image: { inline: true, allowBase64: true },
      // Host-agnostic toolbar: desktop floating toolbar, mobile bottom-sheet.
      mediaToolbar: getMediaToolbarFactory(!!isMobile),
      mediaToolbarIcons: createLucideToolbarIcons(),
      mediaActions: getMediaActionsResolver()
    }),
    MediaUploadPlaceholder,
    MarkdownPaste,
    // Pad only. The chat composer builds its own extension list and must never gain `/`.
    SlashMenu,
    Highlight,
    Typography,
    Table.configure({
      resizable: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    // Not @tiptap/extensions Placeholder: the built-in walks doc.descendants()
    // on every transaction (O(N)); @docs.plus/extension-placeholder does
    // cursor-only checks in state.apply (O(1)). Matters on large collab docs.
    Placeholder.configure({
      placeholder: (props) => buildBreadcrumbPlaceholder(props, { scope: 'top-level' })
    }),
    IOSCaretFix
  ]

  if (!provider) {
    const extensions = [...baseExtensions]

    if (localYdoc) {
      extensions.push(
        Collaboration.configure({
          document: localYdoc
        })
      )
    } else {
      // Never alongside Collaboration: prosemirror-history records y-sync
      // transactions, so Mod-z could undo the IndexedDB hydration.
      extensions.push(UndoRedo)
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
    onContentError({ editor, error, disableCollaboration }) {
      console.error('onContentError', error)
      // Invalid content blocks further remote transactions while local edits
      // keep syncing — freeze this client instead of diverging silently. The
      // freeze is terminal in-session; contentForkError drives the reload copy.
      disableCollaboration()
      editor.setEditable(false, false)
      useStore.getState().setWorkspaceSettings({ contentForkError: true, providerStatus: 'error' })
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

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AVATAR_STAMP_PATTERN = /^[0-9TZ:.+\- ]{1,40}$/
// Google is the only OAuth provider, and it serves profile photos from lhN hosts.
const OAUTH_AVATAR_HOST_PATTERN = /^lh\d+\.googleusercontent\.com$/

// Same face inputs as Avatar: bucket when id + avatarUpdatedAt, else OAuth src.
const resolveCaretAvatarUrl = (caretUser: CaretUser): string | null => {
  const stamp = caretUser.avatarUpdatedAt != null ? String(caretUser.avatarUpdatedAt) : ''
  if (USER_ID_PATTERN.test(caretUser.id) && AVATAR_STAMP_PATTERN.test(stamp)) {
    return Config.app.profile.getAvatarURL(caretUser.id, stamp)
  }
  if (!caretUser.avatarUrl) return null
  try {
    const url = new URL(caretUser.avatarUrl)
    return url.protocol === 'https:' && OAUTH_AVATAR_HOST_PATTERN.test(url.hostname)
      ? url.href
      : null
  } catch {
    return null
  }
}

const getCollaborationCaretConfig = (provider: HocuspocusProvider) => {
  const profile = authStore.getState().profile
  // Shared builder keeps the caret color identical across every awareness
  // writer (useProviderAwareness's updateUser is the other one).
  const user = getCursorUser(profile)

  return {
    provider,
    user,
    // Peers write these fields. Set styles through CSSOM so each value stays one
    // property; the setter drops a value that does not parse.
    render: (caretUser: CaretUser): HTMLElement => {
      const color = String(caretUser.color)
      const cursor = document.createElement('span')
      cursor.classList.add('collaboration-cursor__caret')
      cursor.style.borderColor = color

      const label = document.createElement('div')
      label.classList.add('collaboration-cursor__label')
      label.style.backgroundColor = color
      label.insertBefore(document.createTextNode(caretUser.name), null)
      cursor.insertBefore(label, null)

      const avatarAddress = resolveCaretAvatarUrl(caretUser)
      if (avatarAddress) {
        const avatar = document.createElement('div')
        avatar.classList.add('collaboration-cursor__avatar')
        avatar.style.backgroundImage = `url(${JSON.stringify(avatarAddress)})`
        avatar.style.backgroundColor = 'var(--color-base-300)'
        avatar.style.borderColor = color
        cursor.insertBefore(avatar, null)
      }
      return cursor
    }
  }
}

export default Editor
