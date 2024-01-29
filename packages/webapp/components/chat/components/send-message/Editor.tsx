import { useEditor, EditorContent, Editor } from '@tiptap/react'
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
// import Mention from "@tiptap/extension-mention";
// import suggestion from './suggestion'

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

import { useState, useEffect } from 'react'

export const useTiptapEditor = ({ loading }: any) => {
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')

  const editor: Editor | null = useEditor(
    {
      extensions: [
        StarterKit.configure({
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
        CodeBlockLowlight.configure({
          lowlight
        }),
        // Mention.configure({
        //   HTMLAttributes: {
        //     class: "mention",
        //   },
        //   suggestion,
        // }),
        Placeholder.configure({
          placeholder: 'Write a message...',
          showOnlyWhenEditable: false
        })
      ],
      onUpdate: ({ editor }) => {
        setHtml(editor?.getHTML())
        setText(editor?.getText())
      },
      editable: true,
      editorProps: {
        handleKeyDown: (view, event) => {
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
