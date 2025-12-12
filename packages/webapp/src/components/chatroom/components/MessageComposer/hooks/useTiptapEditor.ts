import { useState, useEffect } from 'react'
import { useEditor, Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { setComposerStateDebounced } from '@db/messageComposerDB'
import { TIPTAP_NODES } from '@types'

import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { Mention } from '@tiptap/extension-mention'

// Code and Syntax Highlighting
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
import suggestion from '../helpers/suggestion'
// Links and Media
import {
  Hyperlink,
  createHyperlinkPopover,
  previewHyperlinkPopover
} from '@docs.plus/extension-hyperlink'

// Custom Extensions
import { InlineCode } from '@docs.plus/extension-inline-code'
import { Indent } from '@docs.plus/extension-indent'
// load all highlight.js languages
import { createLowlight } from 'lowlight'
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

import { handleTypingIndicator, TypingIndicatorType } from '../helpers/handelTypeingIndicator'
import { isOnlyEmoji } from '@utils/emojis'

export const useTiptapEditor = ({
  loading,
  onSubmit,
  workspaceId,
  channelId,
  isToolbarOpen
}: {
  loading: boolean
  onSubmit: () => void
  workspaceId?: string
  channelId: string
  isToolbarOpen?: boolean
}) => {
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')
  const [isEmojiOnly, setIsEmojiOnly] = useState(false)

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
        Indent,
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
          hyperlinkOnPaste: true,
          openOnClick: true,
          autoHyperlink: true,
          popovers: {
            previewHyperlink: previewHyperlinkPopover,
            createHyperlink: createHyperlinkPopover
          }
        })
      ],
      onUpdate: ({ editor }) => {
        const text = editor?.getText()
        const html = editor?.getHTML()

        setHtml(html)
        setText(text)
        setIsEmojiOnly(isOnlyEmoji(text))
        if (text.length) handleTypingIndicator(TypingIndicatorType.StartTyping)

        // Persist draft to IndexedDB with debouncing (500ms)
        if (workspaceId && channelId && text && html) {
          setComposerStateDebounced(workspaceId, channelId, {
            text,
            html,
            isToolbarOpen
          })
        }
      },
      onBlur: () => {
        if (text.length) handleTypingIndicator(TypingIndicatorType.StopTyping)
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
              $from.parent.type.name === TIPTAP_NODES.PARAGRAPH_TYPE && $from.parent.content.size === 0

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

            // Set the selection to the beginning of the new paragraph
            const resolvedPos = tr.doc.resolve(newPos)
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
              if (text.length) handleTypingIndicator(TypingIndicatorType.SentMsg)
              event.preventDefault() // Prevent the new line
              // Dispatch a custom event that SendMessage will listen for
              onSubmit()
              setIsEmojiOnly(false)

              event.preventDefault() // Prevent the new line
              return true // We handled this event
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
    // custom event listener, to handle focus on editor
    const handleFocus = () => {
      editor.commands.focus()
    }
    document.addEventListener('editor:focus', handleFocus)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!loading)
  }, [loading, editor])

  return { editor, html, text, isEmojiOnly, setIsEmojiOnly }
}
