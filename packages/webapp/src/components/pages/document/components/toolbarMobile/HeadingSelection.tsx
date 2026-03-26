import Button from '@components/ui/Button'
import React, { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdOutlineRemove } from 'react-icons/md'

type HeadingSelectionProps = {
  editor: any
}

const HeadingSelection = ({ editor }: HeadingSelectionProps) => {
  const [activeSectionType, setActiveSectionType] = useState<'heading' | 'p'>('p')
  const [headingLevel, setHeadingLevel] = useState<number>(1)

  const updateActiveSectionType = useCallback((args: any) => {
    if (!args || !args.editor || !args?.transaction.selectionSet) return

    for (let i = 1; i <= 6; i++) {
      if (args.editor.isActive('heading', { level: i })) {
        setActiveSectionType('heading')
        setHeadingLevel(i)
        return
      }
    }
    setActiveSectionType('p')
  }, [])

  const changeHeadingLevel = useCallback(
    (hLevel: number) => {
      if ((hLevel < 0 && headingLevel > 1) || (hLevel > 0 && headingLevel < 6)) {
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
      // Prevent changing the title H1 (first heading in doc at pos 0)
      if ($anchor.before($anchor.depth) === 0) {
        return
      }
      editor
        .chain()
        .focus()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
        .run()
    }
  }

  const toggleContentSectionLevel = useCallback(() => {
    editor.view.focus()
    const { $anchor } = editor.state.selection

    // Prevent changing the title H1
    if ($anchor.before($anchor.depth) === 0) {
      return
    }

    if (activeSectionType === 'p') {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: headingLevel as 1 | 2 | 3 | 4 | 5 | 6 })
        .run()
    } else {
      editor.chain().focus().setParagraph().run()
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
      className={`headingSelection ${activeSectionType === 'heading' ? 'is-active' : ''} join rounded-field border-base-300 flex h-9 w-32 items-center justify-between border px-1`}>
      <Button
        variant="ghost"
        size="xs"
        shape="square"
        className="join-item"
        onTouchEnd={() => changeHeadingLevel(-1)}
        disabled={headingLevel === 1}
        startIcon={<MdOutlineRemove size={20} />}
      />
      <span
        className="text-base-content flex h-8 w-8 cursor-pointer items-center justify-center font-semibold"
        onTouchEnd={toggleContentSectionLevel}>
        {`H${headingLevel}`}
      </span>
      <Button
        variant="ghost"
        size="xs"
        shape="square"
        className="join-item"
        onTouchEnd={() => changeHeadingLevel(1)}
        disabled={headingLevel === 6}
        startIcon={<MdAdd size={20} />}
      />
    </div>
  )
}

export default HeadingSelection
