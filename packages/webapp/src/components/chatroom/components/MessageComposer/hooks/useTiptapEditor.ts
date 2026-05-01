import { setComposerStateDebounced } from '@db/messageComposerDB'
import {
  createHyperlinkPopover,
  Hyperlink,
  previewHyperlinkPopover
} from '@docs.plus/extension-hyperlink'
import { Indent } from '@docs.plus/extension-indent'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Mention } from '@tiptap/extension-mention'
import { Placeholder } from '@tiptap/extensions'
import { TextSelection } from '@tiptap/pm/state'
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
import { useEffect, useRef, useState } from 'react'

import suggestion from '../helpers/suggestion'
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

import { isOnlyEmoji } from '@utils/emojis'

import { handleTypingIndicator, TypingIndicatorType } from '../helpers/handleTypingIndicator'

const UPDATE_DEBOUNCE_MS = 150

export const useTiptapEditor = ({
  onSubmit,
  workspaceId,
  channelId,
  isToolbarOpen
}: {
  onSubmit: () => void
  workspaceId?: string
  channelId: string
  isToolbarOpen?: boolean
}) => {
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')
  const [isEmojiOnly, setIsEmojiOnly] = useState(false)
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `useEditor(config, [])` freezes the entire config closure at first
  // render — `workspaceId`, `channelId`, `isToolbarOpen` captured in
  // `onUpdate` would go stale across channel switches if the composer
  // were ever kept alive between channels. Route them through a ref so
  // the debounced IDB write always targets the current channel.
  const draftCtxRef = useRef({ workspaceId, channelId, isToolbarOpen })
  useEffect(() => {
    draftCtxRef.current = { workspaceId, channelId, isToolbarOpen }
  }, [workspaceId, channelId, isToolbarOpen])

  const editor: Editor | null = useEditor(
    {
      extensions: [
        StarterKit.configure({
          code: false, // Disable default code to use our custom InlineCode extension
          codeBlock: false,
          bulletList: {
            keepMarks: true,
            keepAttributes: false // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
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
          popovers: {
            previewHyperlink: previewHyperlinkPopover,
            createHyperlink: createHyperlinkPopover
          }
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
          if (ctx.workspaceId && ctx.channelId && text && html) {
            setComposerStateDebounced(ctx.workspaceId, ctx.channelId, {
              text,
              html,
              isToolbarOpen: ctx.isToolbarOpen
            })
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
          if (event.key === 'Enter' && event.shiftKey) {
            // Check if the current selection is inside a list item
            const { $from } = view.state.selection

            // Check if we're inside a list item
            const inList = $from.node(2)?.type.name === TIPTAP_NODES.LISTITEM_TYPE
            if (inList) {
              // Create a new list item by splitting the current one
              editor?.commands.splitListItem(TIPTAP_NODES.LISTITEM_TYPE)

              return true // We handled this event
            }

            const isEmptyParagraph =
              $from.parent.type.name === TIPTAP_NODES.PARAGRAPH_TYPE &&
              $from.parent.content.size === 0

            // Create a new paragraph
            let tr
            let newPos

            if (isEmptyParagraph) {
              // For empty paragraphs, we need to insert a new node after the current one
              const pos = $from.after()
              const newNode = view.state.schema.nodes.paragraph.create()
              tr = view.state.tr.insert(pos, newNode)
              newPos = pos + 1 // Position inside the new paragraph
            } else {
              // For non-empty paragraphs, replace selection with new paragraph
              const newNode = view.state.schema.nodes.paragraph.create()
              tr = view.state.tr.replaceSelectionWith(newNode)
              newPos = $from.pos + 1 // Position inside the new paragraph
            }

            // Apply the transaction and scroll into view
            tr = tr.scrollIntoView()

            tr = tr.setSelection(TextSelection.create(tr.doc, newPos))

            view.dispatch(tr)

            // Ensure focus is maintained after the operation
            setTimeout(() => {
              if (editor) {
                editor.commands.focus('end')
              }
            }, 0)

            return true // We handled this event
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            // Check if mention popup is visible (Floating UI)
            const mentionPopup = document.querySelector('.mention-suggestion-popup')
            const isPopupVisible =
              mentionPopup && window.getComputedStyle(mentionPopup).display !== 'none'

            if (isPopupVisible) {
              event.preventDefault()
              event.stopPropagation()

              return false
            } else {
              if (view.state.doc.textContent.length) {
                handleTypingIndicator(TypingIndicatorType.SentMsg)
              }
              event.preventDefault() // Prevent the new line
              onSubmit()
              setIsEmojiOnly(false)
              return true
            }
          }
          if (event.key === 'Enter' && event.metaKey) {
            return false // Let TipTap handle Cmd+Enter
          }
          // Return false to let other keydown handlers (or TipTap defaults) process the event
          return false
        }
      }
    },
    []
  )

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

  // Optimistic UI: keep the editor editable during in-flight sends.
  // Each send carries its own client UUID; rapid-fire is supported.
  // (The previous `editor.setEditable(!loading)` blocked the next
  // keystroke until the network responded — anti-pattern for chat.)

  // Flush the debounced onUpdate timer on unmount so the closure doesn't
  // fire setHtml/setText on a dead component or write IDB to a stale key.
  useEffect(
    () => () => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current)
    },
    []
  )

  return { editor, html, text, isEmojiOnly, setIsEmojiOnly }
}
