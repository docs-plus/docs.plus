import React, { useState, useCallback, useEffect } from 'react'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Editor } from '@tiptap/core'
import PubSub from 'pubsub-js'
import { CHAT_COMMENT } from '@services/eventsHub'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { HighlightMarker } from '@icons'
import { useStore } from '@stores'
import {
  MdTextFormat,
  MdInsertLink,
  MdOutlineImage,
  MdOutlineComment,
  MdAdd,
  MdOutlineRemove,
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdOutlineStrikethroughS,
  MdChecklist,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatClear
} from 'react-icons/md'

const HeadingSelection = ({ editor }: { editor: any }) => {
  const [currentHeading, setCurrentHeading] = useState<number | 'p'>('p')

  const updateCurrentHeading = useCallback(() => {
    for (let i = 1; i <= 9; i++) {
      if (editor.isActive('contentHeading', { level: i })) {
        setCurrentHeading(i)
        return
      }
    }
    setCurrentHeading('p')
  }, [editor])

  const increaseHeading = useCallback(() => {
    console.log('increaseHeading', { currentHeading })
    if (currentHeading === 'p') {
      editor.chain().focus().wrapBlock({ level: 1 }).run()
    } else if (currentHeading < 9) {
      editor
        .chain()
        .focus()
        .wrapBlock({ level: currentHeading + 1 })
        .run()
    }
    updateCurrentHeading()
  }, [editor, currentHeading, updateCurrentHeading])

  const decreaseHeading = useCallback(() => {
    console.log('decreaseHeading', { currentHeading })
    if (currentHeading === 1) {
      editor.chain().focus().normalText().run()
    } else if (currentHeading !== 'p') {
      editor
        .chain()
        .focus()
        .wrapBlock({ level: currentHeading - 1 })
        .run()
    }
    updateCurrentHeading()
  }, [editor, currentHeading, updateCurrentHeading])

  React.useEffect(() => {
    updateCurrentHeading()
    const updateListener = () => updateCurrentHeading()
    editor.on('selectionUpdate', updateListener)
    editor.on('update', updateListener)
    return () => {
      editor.off('selectionUpdate', updateListener)
      editor.off('update', updateListener)
    }
  }, [editor, updateCurrentHeading])

  return (
    <div className="flex h-9 w-32 items-center justify-between rounded-md border border-gray-400 px-2">
      <button onTouchEnd={decreaseHeading}>
        <MdOutlineRemove size={24} />
      </button>
      <p>{currentHeading === 'p' ? 'P' : `H${currentHeading}`}</p>
      <button onTouchEnd={increaseHeading}>
        <MdAdd size={24} />
      </button>
    </div>
  )
}

const FormatSelection = ({ isVisible, editor }: { isVisible: boolean; editor: any }) => {
  return (
    <div
      className={`tiptap-toolbar-mobile__format-selection absolute left-0 top-0 z-0 w-full space-y-6 rounded-t-3xl bg-base-100 px-4 py-6 transition-all ${
        isVisible
          ? '-translate-y-[134px] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),_0_-2px_4px_-1px_rgba(0,0,0,0.06)]'
          : 'translate-y-[0]'
      } `}>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleBold().run()}
          editor={editor}
          type="bold">
          <MdFormatBold size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleItalic().run()}
          editor={editor}
          type="italic">
          <MdFormatItalic size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleUnderline().run()}
          editor={editor}
          type="underline">
          <MdFormatUnderlined size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleStrike().run()}
          editor={editor}
          type="strike">
          <MdOutlineStrikethroughS size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleHighlight().run()}
          editor={editor}
          type="highlight">
          <HighlightMarker size={20} />
        </ToolbarButton>
      </div>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleTaskList().run()}
          editor={editor}
          type="taskList">
          <MdChecklist size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleBulletList().run()}
          editor={editor}
          type="bulletList">
          <MdFormatListBulleted size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleOrderedList().run()}
          editor={editor}
          type="orderedList">
          <MdFormatListNumbered size={24} />
        </ToolbarButton>
        <div className="divided"></div>

        <ToolbarButton
          onTouchEnd={() => {
            const range = editor.view.state.selection.ranges[0]
            if (range.$from === range.$to) {
              editor.commands.clearNodes()
            } else {
              editor.commands.unsetAllMarks()
            }
          }}
          editor={editor}
          type="clearFormatting">
          <MdFormatClear size={24} />
        </ToolbarButton>
      </div>
    </div>
  )
}

const ToolbarMobile = () => {
  const [isFormatSelectionVisible, setIsFormatSelectionVisible] = useState(false)
  const {
    editor: { instance: editor, isEditable }
  } = useStore((state) => state.settings)

  const isKeyboardOpen = useDetectKeyboardOpen() || false

  useEffect(() => {
    if (isEditable) {
      setIsFormatSelectionVisible(false)
    }
  }, [isEditable])

  const createComment = useCallback((editor: Editor) => {
    const { selection } = editor.view.state

    // if no selection, do nothing
    if (selection.empty) return
    // TODO: check for higher heading node
    let headingNode = null
    let depth = selection.$from.depth
    while (depth > 0) {
      const node = selection.$from.node(depth)
      if (node.type.name.startsWith('heading')) {
        headingNode = node
        break
      }
      depth--
    }
    const headingId = headingNode?.attrs.id

    if (!headingId) {
      console.error('[chatComment]: No headingId found')
      return
    }

    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, '\n')
    const selectedHtml = '' //editor.view.dom.innerHTML.slice(selection.from, selection.to)

    PubSub.publish(CHAT_COMMENT, {
      content: selectedText,
      html: selectedHtml,
      headingId
    })
  }, [])

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

    editor.view.focus()

    if (action === 'toggleFormatSelection') {
      setIsFormatSelectionVisible(!isFormatSelectionVisible)
    } else if (action === 'addComment') {
      createComment(editor)
    } else {
      // @ts-ignore
      editor.chain().focus()[action]().run()
    }
  }

  return (
    <div
      className="tiptap-toolbar-mobile relative"
      onTouchEnd={(event) => {
        event.preventDefault()
        event.stopPropagation()
        editor.view.focus()
      }}>
      <FormatSelection isVisible={isFormatSelectionVisible} editor={editor} />
      <div className="tiptap-toolbar-mobile__main relative z-10 flex h-14 items-center justify-around gap-1 bg-base-100">
        <HeadingSelection editor={editor} />
        {buttons.map(({ name, icon: Icon, action, size, tooltip }) => (
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
