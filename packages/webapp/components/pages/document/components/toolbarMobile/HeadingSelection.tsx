import React, { useState, useCallback, useEffect } from 'react'
import { MdAdd, MdOutlineRemove } from 'react-icons/md'

type HeadingSelectionProps = {
  editor: any
}

const HeadingSelection = ({ editor }: HeadingSelectionProps) => {
  const [activeSectionType, setActiveSectionType] = useState<'heading' | 'p'>('p')
  const [headingLevel, setHeadingLevel] = useState<number>(1)

  const updateActiveSectionType = useCallback((args: any) => {
    if (!args || !args.editor || !args?.transaction.selectionSet) return

    const { selection } = args.editor.state
    const {
      $from: { pos }
    } = selection

    // Get the DOM node at the current position
    const domNode = args.editor.view.domAtPos(pos).node
    // Find the closest parent with the ".heading" class
    const closestHeadingLevel = +domNode?.parentElement?.closest('.heading')?.getAttribute('level')
    // If the closest heading level is not a number, set the heading level to 1
    setHeadingLevel(isNaN(closestHeadingLevel) ? 1 : closestHeadingLevel)

    for (let i = 1; i <= 9; i++) {
      if (args.editor.isActive('contentHeading', { level: i })) {
        setActiveSectionType('heading')
        setHeadingLevel(i)
        return
      }
    }
    setActiveSectionType('p')
  }, [])

  const changeHeadingLevel = useCallback(
    (hLevel: number) => {
      if ((hLevel < 0 && headingLevel > 1) || (hLevel > 0 && headingLevel < 9)) {
        const newLevel = headingLevel + hLevel
        setHeadingLevel(newLevel)
        applyHeadingLevel(newLevel)
      }
    },
    [headingLevel]
  )

  const applyHeadingLevel = (level: number) => {
    editor.view.focus()
    const { $anchor } = editor.state.selection

    if (activeSectionType === 'heading') {
      // Prevent changing or removing the first Title node
      if ($anchor.pos - $anchor.parentOffset === 2) {
        return
      }
      editor.chain().focus().wrapBlock({ level }).run()
    }
  }

  const toggleContentSectionLevel = useCallback(() => {
    editor.view.focus()
    const { $anchor } = editor.state.selection

    // Prevent changing or removing the first Title node
    if ($anchor.pos - $anchor.parentOffset === 2) {
      return
    }

    if (activeSectionType === 'p') {
      editor.chain().focus().wrapBlock({ level: headingLevel }).run()
    } else {
      editor.chain().focus().normalText().run()
    }
  }, [headingLevel, editor, activeSectionType])

  useEffect(() => {
    editor.on('selectionUpdate', updateActiveSectionType)
    editor.on('update', updateActiveSectionType)
    return () => {
      editor.off('selectionUpdate', updateActiveSectionType)
      editor.off('update', updateActiveSectionType)
    }
  }, [editor, updateActiveSectionType])

  return (
    <div
      className={`headingSelection ${activeSectionType === 'heading' ? 'is-active' : ''} flex h-9 w-32 items-center justify-between rounded-md border border-gray-400 px-2`}>
      <button onTouchEnd={() => changeHeadingLevel(-1)} disabled={headingLevel === 1}>
        <MdOutlineRemove size={24} />
      </button>
      <p
        className="flex h-8 w-8 items-center justify-center font-semibold"
        onTouchEnd={toggleContentSectionLevel}>
        {`H${headingLevel}`}
      </p>
      <button onTouchEnd={() => changeHeadingLevel(1)} disabled={headingLevel === 9}>
        <MdAdd size={24} />
      </button>
    </div>
  )
}

export default HeadingSelection
