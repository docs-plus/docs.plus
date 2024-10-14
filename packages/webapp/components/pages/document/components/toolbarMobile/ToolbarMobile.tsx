import React, { useState, useEffect } from 'react'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { useStore } from '@stores'
import { MdTextFormat, MdInsertLink, MdOutlineImage, MdOutlineComment } from 'react-icons/md'

import FormatSelection from './FormatSelection'
import HeadingSelection from './HeadingSelection'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'

const ToolbarMobile = () => {
  const [isFormatSelectionVisible, setIsFormatSelectionVisible] = useState(false)
  const {
    editor: { instance: editor, isEditable }
  } = useStore((state) => state.settings)

  const { createComment } = useTurnSelectedTextIntoComment()

  useEffect(() => {
    if (isEditable) {
      setIsFormatSelectionVisible(false)
    }
  }, [isEditable])

  if (!editor) {
    return null
  }

  const buttons = [
    {
      name: 'hyperlink',
      icon: MdInsertLink,
      action: 'toggleLink',
      size: 26,
      tooltip: 'Insert Link'
    },
    { name: 'image', icon: MdOutlineImage, action: 'addImage', size: 24, tooltip: 'Insert Image' },
    {
      name: 'comment',
      icon: MdOutlineComment,
      action: 'addComment',
      size: 24,
      tooltip: 'Add Comment'
    }
  ]

  const handleButtonClick = (event: React.TouchEvent | React.MouseEvent, action: string) => {
    event.preventDefault()
    event.stopPropagation()

    if (action === 'toggleFormatSelection') {
      setIsFormatSelectionVisible(!isFormatSelectionVisible)
    } else if (action === 'addComment') {
      createComment(editor)
    } else {
      // @ts-ignore
      editor.chain().focus()[action]().run()
    }
  }

  const stayFocused = (event: React.TouchEvent | React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    editor.view.focus()
  }

  return (
    <div className="tiptap-toolbar-mobile relative" onTouchEnd={stayFocused}>
      <FormatSelection isVisible={isFormatSelectionVisible} editor={editor} />
      <div className="tiptap-toolbar-mobile__main relative z-10 flex h-14 items-center justify-around gap-1 bg-base-100">
        <HeadingSelection editor={editor} />
        {buttons.map(({ name, icon: Icon, action, size }) => (
          <ToolbarButton
            key={name}
            onTouchEnd={(event) => handleButtonClick(event, action)}
            editor={editor}
            type={name}>
            <Icon size={size} />
          </ToolbarButton>
        ))}

        <ToolbarButton
          isActive={isFormatSelectionVisible}
          onTouchEnd={(event) => {
            handleButtonClick(event, 'toggleFormatSelection')
          }}
          type="formats">
          <MdTextFormat size={30} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default ToolbarMobile
