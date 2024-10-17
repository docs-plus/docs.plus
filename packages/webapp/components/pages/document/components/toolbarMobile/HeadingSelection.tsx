import React, { useState, useCallback, useEffect } from 'react'
import { MdAdd, MdOutlineRemove } from 'react-icons/md'

const HeadingSelection = ({ editor }: { editor: any }) => {
  const [currentHeading, setCurrentHeading] = useState<'heading' | 'p'>('p')
  const [currentHeadingLevel, setCurrentHeadingLevel] = useState<number>(1)

  const updateCurrentHeading = useCallback(() => {
    for (let i = 1; i <= 9; i++) {
      if (editor.isActive('contentHeading', { level: i })) {
        setCurrentHeading('heading')
        setCurrentHeadingLevel(i)
        return
      }
    }
    setCurrentHeading('p')
  }, [editor])

  const decreaseHeadingLevel = useCallback(() => {
    if (currentHeadingLevel > 1) {
      setCurrentHeadingLevel(currentHeadingLevel - 1)
      changeHeadingLevel(currentHeadingLevel - 1)
    }
  }, [currentHeadingLevel])

  const increaseHeadingLevel = useCallback(() => {
    if (currentHeadingLevel <= 9) {
      setCurrentHeadingLevel(currentHeadingLevel + 1)
      changeHeadingLevel(currentHeadingLevel + 1)
    }
  }, [currentHeadingLevel])

  const changeHeadingLevel = (level: number) => {
    editor.view.focus()
    const { $anchor } = editor.state.selection

    if (currentHeading === 'heading') {
      // prevent to change or remove first Title node
      if ($anchor.pos - $anchor.parentOffset === 2) {
        return false
      }

      editor.chain().focus().wrapBlock({ level: +level }).run()
    }
  }

  const toggleContentSectionLevel = useCallback(() => {
    editor.view.focus()
    const { $anchor } = editor.state.selection

    // prevent to change or remove first Title node
    if ($anchor.pos - $anchor.parentOffset === 2) {
      return false
    }

    if (currentHeading === 'p') {
      editor.chain().focus().wrapBlock({ level: +currentHeadingLevel }).run()
    } else {
      editor.chain().focus().normalText().run()
    }
  }, [currentHeadingLevel, editor, currentHeading])

  useEffect(() => {
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
    <div
      className={`headingSelection ${currentHeading === 'heading' ? 'is-active' : ''} flex h-9 w-32 items-center justify-between rounded-md border border-gray-400 px-2`}>
      <button onTouchEnd={decreaseHeadingLevel}>
        <MdOutlineRemove size={24} />
      </button>
      <p
        className="flex h-8 w-8 items-center justify-center font-semibold"
        onTouchEnd={toggleContentSectionLevel}>{`H${currentHeadingLevel}`}</p>
      <button onTouchEnd={increaseHeadingLevel}>
        <MdAdd size={24} />
      </button>
    </div>
  )
}

export default HeadingSelection
