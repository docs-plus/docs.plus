import { useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { twMerge } from 'tailwind-merge'
import { Link } from '@icons'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Icon from '@components/TipTap/toolbar/Icon'
import { MdCode } from 'react-icons/md'
import { TbBlockquote } from 'react-icons/tb'
import { RiAtLine, RiCodeBlock } from 'react-icons/ri'
import { PiCodeBlock } from 'react-icons/pi'

export const EditorToolbar = ({ editor, className }: { editor: Editor; className: any }) => {
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

  const toolbarStyle = twMerge(
    'chatroom__toolbar border-none flex h-9 w-full flex-row items-center justify-start bg-base-300 gap-1',
    className
  )

  const handleCode = () => {
    if (!editor) return
    editor.chain().focus().toggleInlineCode().run()
  }

  return (
    <div className={toolbarStyle}>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        editor={editor}
        type="bold"
        tooltip="Bold (⌘+B)">
        <Icon type="Bold" size={10} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        editor={editor}
        type="italic"
        tooltip="Italic (⌘+I)">
        <Icon type="Italic" size={10} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        editor={editor}
        type="strike"
        tooltip="Strike (⌘+⇧+S)">
        <Icon type="Stric" size={14} />
      </ToolbarButton>
      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHyperlink().run()}
        editor={editor}
        tooltip="Hyperlink (⌘+K)"
        type="hyperlink">
        <Link fill="rgba(0,0,0,.7)" size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        editor={editor}
        type="bulletList"
        tooltip="Bullet List (⌘+⇧+7)">
        <Icon type="BulletList" size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        editor={editor}
        type="orderedList"
        tooltip="Ordered List (⌘+⇧+7)">
        <Icon type="OrderList" size={16} />
      </ToolbarButton>
      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        editor={editor}
        type="blockquote"
        tooltip="Blockquote (⌘+⇧+9)">
        <TbBlockquote size={20} />
      </ToolbarButton>

      <ToolbarButton onClick={handleCode} editor={editor} type="inlineCode" tooltip="Code (⌘+⇧+c)">
        <MdCode size={20} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        editor={editor}
        type="codeBlock"
        tooltip="Code Block (⌘+⇧+⌥+c)">
        <RiCodeBlock size={20} />
      </ToolbarButton>
    </div>
  )
}
