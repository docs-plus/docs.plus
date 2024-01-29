import { useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { twx } from '@utils/twx'
import { twMerge } from 'tailwind-merge'

import {
  FaBold,
  FaItalic,
  FaListOl,
  FaListUl,
  FaCode,
  FaStrikethrough,
  FaQuoteRight
} from 'react-icons/fa6'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean }

const IconButton = twx.button<BtnIcon>(
  (prop) => `btn btn-ghost w-9 h-9 btn-xs mr-2 ${prop.$active ? 'btn-active' : ''}`
)

export const EditorToolbar = ({
  editor,
  className,
  style
}: {
  editor: Editor
  className: any
  style: any
}) => {
  const [isFocused, setIsFocused] = useState(false)

  // Update the focus state based on editor's events
  useEffect(() => {
    const updateFocus = () => setIsFocused(editor.isFocused)
    editor.on('focus', updateFocus)
    editor.on('blur', updateFocus)

    // Cleanup
    return () => {
      editor.off('focus', updateFocus)
      editor.off('blur', updateFocus)
    }
  }, [editor])

  // Function to determine the background color based on the state and editor's isActive method
  const getBackgroundColor = (condition: any) => {
    if (!isFocused) {
      return 'grey.700' // Replace with your desired color when not focused
    }
    return condition ? 'grey.500' : ''
  }

  const toolbarStyle = twMerge(
    'flex h-9 w-full flex-row items-center justify-start bg-base-200',
    className
  )

  return (
    <div className={toolbarStyle} style={style}>
      <IconButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        $active={editor.isActive('bold')}>
        <FaBold size={16} style={{ color: getBackgroundColor(editor.isActive('bold')) }} />
      </IconButton>
      <IconButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        $active={editor.isActive('italic')}>
        <FaItalic size={16} style={{ color: getBackgroundColor(editor.isActive('italic')) }} />
      </IconButton>
      <IconButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        $active={editor.isActive('strike')}>
        <FaStrikethrough
          size={16}
          style={{ color: getBackgroundColor(editor.isActive('strike')) }}
        />
      </IconButton>
      <hr />
      <IconButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        $active={editor.isActive('bulletList')}>
        <FaListUl size={26} style={{ color: getBackgroundColor(editor.isActive('bulletList')) }} />
      </IconButton>
      <IconButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        $active={editor.isActive('orderedList')}>
        <FaListOl size={26} style={{ color: getBackgroundColor(editor.isActive('orderedList')) }} />
      </IconButton>
      <hr />

      <IconButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        $active={editor.isActive('codeBlock')}>
        <FaCode size={26} style={{ color: getBackgroundColor(editor.isActive('codeBlock')) }} />
      </IconButton>
      <IconButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        $active={editor.isActive('blockquote')}>
        <FaQuoteRight
          size={26}
          style={{ color: getBackgroundColor(editor.isActive('blockquote')) }}
        />
      </IconButton>
      {/* <IconButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
      >
        <UndoIcon />
      </IconButton>
      <IconButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
      >
        <RedoIcon />
      </IconButton> */}
    </div>
  )
}
