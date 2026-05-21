import { getHyperlinkPopoverConfig } from '@components/TipTap/hyperlinkPopovers/getHyperlinkPopoverConfig'
import { syncComposerDraft } from '@db/messageComposerDB'
import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { Indent } from '@docs.plus/extension-indent'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Mention } from '@tiptap/extension-mention'
import { Placeholder } from '@tiptap/extensions'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Editor, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { TIPTAP_NODES } from '@types'
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
import { useCallback, useEffect, useRef, useState } from 'react'

import { isMentionSuggestionPopupVisible } from '../helpers/mentionTypes'
import suggestion from '../helpers/suggestion'
import { isComposerLinkDialogOpen } from '../stores/composerLinkDialogStore'
import { snapshotComposerLinkSelection } from '../stores/composerLinkSelectionRef'
const lowlight = createLowlight()
lowlight.register('html', html)
lowlight.register('css', css)
lowlight.register('js', js)
lowlight.register('ts', ts)
lowlight.register('markdown', md)
// @ts-expect-error highlight.js language modules ship loose types
lowlight.register('python', python)
lowlight.register('yaml', yaml)
lowlight.register('json', json)
// @ts-expect-error highlight.js language modules ship loose types
lowlight.register('bash', bash)

import { isOnlyEmoji } from '@utils/emojis'

import { handleTypingIndicator, TypingIndicatorType } from '../helpers/handleTypingIndicator'

const UPDATE_DEBOUNCE_MS = 150

function insertComposerNewline(view: EditorView, editor: Editor | null): boolean {
  const { $from } = view.state.selection
  const inList = $from.node(2)?.type.name === TIPTAP_NODES.LISTITEM_TYPE
  if (inList) {
    editor?.commands.splitListItem(TIPTAP_NODES.LISTITEM_TYPE)
    return true
  }

  const isEmptyParagraph =
    $from.parent.type.name === TIPTAP_NODES.PARAGRAPH_TYPE && $from.parent.content.size === 0

  let tr
  let newPos

  if (isEmptyParagraph) {
    const pos = $from.after()
    const newNode = view.state.schema.nodes.paragraph.create()
    tr = view.state.tr.insert(pos, newNode)
    newPos = pos + 1
  } else {
    const newNode = view.state.schema.nodes.paragraph.create()
    tr = view.state.tr.replaceSelectionWith(newNode)
    newPos = $from.pos + 1
  }

  tr = tr.scrollIntoView()
  tr = tr.setSelection(TextSelection.create(tr.doc, newPos))
  view.dispatch(tr)

  setTimeout(() => {
    if (editor && !editor.isDestroyed) editor.commands.focus('end')
  }, 0)

  return true
}

export const useTiptapEditor = ({
  onSubmit,
  workspaceId,
  channelId,
  submitOnEnter = true,
  isComposerMobile = false
}: {
  onSubmit: () => void
  workspaceId?: string
  channelId: string
  submitOnEnter?: boolean
  /** Chatroom surface — not `settings.editor.isMobile`, which is set in an effect after first paint. */
  isComposerMobile?: boolean
}) => {
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')
  const [isEmojiOnly, setIsEmojiOnly] = useState(false)
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftHydratedRef = useRef(false)

  const submitOnEnterRef = useRef(submitOnEnter)
  submitOnEnterRef.current = submitOnEnter
  const isComposerMobileRef = useRef(isComposerMobile)
  isComposerMobileRef.current = isComposerMobile
  const editorInstanceRef = useRef<Editor | null>(null)

  const draftCtxRef = useRef({ workspaceId, channelId })
  useEffect(() => {
    draftCtxRef.current = { workspaceId, channelId }
  }, [workspaceId, channelId])

  const setDraftHydrated = useCallback((hydrated: boolean) => {
    draftHydratedRef.current = hydrated
  }, [])

  const editor: Editor | null = useEditor(
    {
      extensions: [
        StarterKit.configure({
          link: false, // Hyperlink extension owns <a> marks; StarterKit Link duplicates autolink/schema.
          code: false, // Disable default code to use our custom InlineCode extension
          codeBlock: false,
          bulletList: {
            keepMarks: true,
            keepAttributes: false // TODO: keepAttributes:true loses marks; investigating upstream.
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false // TODO: keepAttributes:true loses marks; investigating upstream.
          }
        }),
        InlineCode,
        Indent.configure({
          indentChars: '\t'
        }),
        CodeBlockLowlight.configure({
          lowlight
        }),
        Mention.configure({
          HTMLAttributes: {
            class: 'mention'
          },
          suggestion
        }),
        Placeholder.configure({
          placeholder: 'Write a message...',
          showOnlyWhenEditable: false
        }),
        Hyperlink.configure({
          protocols: ['ftp', 'mailto'],
          linkOnPaste: true,
          openOnClick: true,
          autolink: true,
          popovers: getHyperlinkPopoverConfig(isComposerMobile, 'composer')
        })
      ],
      onUpdate: ({ editor }) => {
        if (editor?.getText().length) {
          handleTypingIndicator(TypingIndicatorType.StartTyping)
        }

        if (updateTimerRef.current) clearTimeout(updateTimerRef.current)
        updateTimerRef.current = setTimeout(() => {
          updateTimerRef.current = null
          const text = editor?.getText() ?? ''
          const html = editor?.getHTML() ?? ''
          setHtml(html)
          setText(text)
          setIsEmojiOnly(isOnlyEmoji(text))

          const ctx = draftCtxRef.current
          if (draftHydratedRef.current && ctx.workspaceId && ctx.channelId) {
            syncComposerDraft(ctx.workspaceId, ctx.channelId, { text, html })
          }
        }, UPDATE_DEBOUNCE_MS)
      },
      onBlur: ({ editor }) => {
        if (editor.getText().length) handleTypingIndicator(TypingIndicatorType.StopTyping)
      },
      editable: true,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        handleKeyDown: (view, event) => {
          if (event.key === 'Enter' && event.metaKey) return false
          if (event.key !== 'Enter') return false

          if (isMentionSuggestionPopupVisible()) {
            event.preventDefault()
            return false
          }

          if (isComposerMobileRef.current && isComposerLinkDialogOpen()) {
            event.preventDefault()
            return false
          }

          if (event.shiftKey || !submitOnEnterRef.current) {
            event.preventDefault()
            return insertComposerNewline(view, editorInstanceRef.current)
          }

          if (view.state.doc.textContent.length) {
            handleTypingIndicator(TypingIndicatorType.SentMsg)
          }
          event.preventDefault()
          onSubmit()
          setIsEmojiOnly(false)
          return true
        }
      }
    },
    []
  )

  editorInstanceRef.current = editor

  useEffect(() => {
    if (!editor) return
    const handleFocus = () => {
      editor.commands.focus()
    }
    document.addEventListener('editor:focus', handleFocus)
    return () => {
      document.removeEventListener('editor:focus', handleFocus)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || !isComposerMobile) return
    const onSelectionUpdate = ({ editor: ed }: { editor: Editor }) => {
      snapshotComposerLinkSelection(ed)
    }
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
    }
  }, [editor, isComposerMobile])

  const cancelPendingEditorDraftCapture = () => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current)
      updateTimerRef.current = null
    }
  }

  // Flush debounced onUpdate on unmount so IDB doesn't write to a stale key.
  useEffect(
    () => () => {
      cancelPendingEditorDraftCapture()
    },
    []
  )

  return {
    editor,
    html,
    text,
    isEmojiOnly,
    setIsEmojiOnly,
    cancelPendingEditorDraftCapture,
    setDraftHydrated
  }
}
