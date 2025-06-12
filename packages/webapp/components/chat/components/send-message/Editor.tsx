import { useState, useEffect } from 'react'
import { useEditor, Editor } from '@tiptap/react'

// Code and Syntax Highlighting
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import css from 'highlight.js/lib/languages/css'
import js from 'highlight.js/lib/languages/javascript'
import ts from 'highlight.js/lib/languages/typescript'
import html from 'highlight.js/lib/languages/xml'
import md from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
// import python from "highlight.js/lib/languages/python";
import json from 'highlight.js/lib/languages/json'
// import bash from "highlight.js/lib/languages/bash";
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import suggestion from './suggestion'

// Links and Media
import previewHyperlinkModal from '@components/TipTap/hyperlinkModals/previewHyperlink'
import setHyperlinks from '@components/TipTap/hyperlinkModals/setHyperlink'
import Hyperlink from '@docs.plus/extension-hyperlink'

// Custom Extensions
import { InlineCode } from '../../../../../extension-inline-code/dist'
import { Indent } from '@docs.plus/extension-indent'
// load all highlight.js languages
import { createLowlight } from 'lowlight'
const lowlight = createLowlight()
lowlight.register('html', html)
lowlight.register('css', css)
lowlight.register('js', js)
lowlight.register('ts', ts)
lowlight.register('markdown', md)
// lowlight.register("python", python);
lowlight.register('yaml', yaml)
lowlight.register('json', json)
// lowlight.register("bash", bash);

import { handleTypingIndicator, TypingIndicatorType } from './handelTypeingIndicator'

export const useTiptapEditor = ({ loading }: any) => {
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')

  const editor: Editor | null = useEditor(
    {
      extensions: [
        StarterKit.configure({
          code: false, // Disable default code to use our custom InlineCode extension
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
          modals: {
            previewHyperlink: (data: any) => {
              return previewHyperlinkModal(data)
            },
            setHyperlink: (data: any) => {
              return setHyperlinks(data)
            }
          }
        })
      ],
      onUpdate: ({ editor }) => {
        const text = editor?.getText()
        setHtml(editor?.getHTML())
        setText(editor?.getText())
        if (text.length) handleTypingIndicator(TypingIndicatorType.StartTyping)
      },
      onBlur: () => {
        if (text.length) handleTypingIndicator(TypingIndicatorType.StopTyping)
      },
      editable: true,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        handleKeyDown: (view, event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            const tippyInstance = document.querySelector('[data-tippy-root]')
            const isPopupVisible =
              tippyInstance && window.getComputedStyle(tippyInstance).visibility === 'visible'

            if (isPopupVisible) {
              event.preventDefault()
              event.stopPropagation()
              return false
            } else {
              if (text.length) handleTypingIndicator(TypingIndicatorType.SentMsg)
              return false // Indicates that this key event was handled
            }
          }
          if (event.key === 'Enter' && event.metaKey) {
            return true // Indicates that this key event was handled
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

  return { editor, html, text }
}
