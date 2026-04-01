import { setParagraphStyle } from '@components/TipTap/extensions/paragraph-style/commands'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import React, { useCallback, useEffect, useState } from 'react'

interface HeadingSelectionProps {
  editor: Editor
}

type SectionKind = 'heading' | 'p' | 'subtitle'

const HeadingSelection = ({ editor }: HeadingSelectionProps) => {
  const [activeSectionType, setActiveSectionType] = useState<SectionKind>('p')
  const [headingLevel, setHeadingLevel] = useState<number>(1)

  const syncFromEditor = useCallback((ed: Editor) => {
    if (ed.isActive('paragraph', { paragraphStyle: 'subtitle' })) {
      setActiveSectionType('subtitle')
      return
    }
    for (let i = 1; i <= 6; i++) {
      if (ed.isActive('heading', { level: i })) {
        setActiveSectionType('heading')
        setHeadingLevel(i)
        return
      }
    }
    setActiveSectionType('p')
  }, [])

  const changeHeadingLevel = useCallback(
    (delta: number) => {
      const { $anchor } = editor.state.selection
      if ($anchor.before($anchor.depth) === 0) return

      if ((delta < 0 && headingLevel > 1) || (delta > 0 && headingLevel < 6)) {
        const newLevel = headingLevel + delta
        setHeadingLevel(newLevel)
        if (activeSectionType === 'heading') {
          editor
            .chain()
            .focus()
            .setHeading({ level: newLevel as 1 | 2 | 3 | 4 | 5 | 6 })
            .run()
        }
      }
    },
    [headingLevel, editor, activeSectionType]
  )

  const toggleContentSectionLevel = useCallback(() => {
    editor.view.focus()
    const { $anchor } = editor.state.selection

    if ($anchor.before($anchor.depth) === 0) return

    if (activeSectionType === 'subtitle') {
      editor
        .chain()
        .focus()
        .setHeading({ level: headingLevel as 1 | 2 | 3 | 4 | 5 | 6 })
        .run()
      return
    }

    if (activeSectionType === 'p') {
      editor
        .chain()
        .focus()
        .setHeading({ level: headingLevel as 1 | 2 | 3 | 4 | 5 | 6 })
        .run()
    } else {
      editor.chain().focus().setParagraph().run()
      setParagraphStyle(editor, 'normal')
    }
  }, [headingLevel, editor, activeSectionType])

  useEffect(() => {
    const onSel = () => syncFromEditor(editor)
    const onUp = () => syncFromEditor(editor)
    editor.on('selectionUpdate', onSel)
    editor.on('update', onUp)
    syncFromEditor(editor)
    return () => {
      editor.off('selectionUpdate', onSel)
      editor.off('update', onUp)
    }
  }, [editor, syncFromEditor])

  const isFirstBlock = editor.state.selection.$from.before(1) === 0
  const isStyled = activeSectionType === 'heading' || activeSectionType === 'subtitle'

  let centerLabel = `H${headingLevel}`
  if (isFirstBlock && activeSectionType === 'heading' && headingLevel === 1) {
    centerLabel = 'Title'
  } else if (activeSectionType === 'subtitle') {
    centerLabel = 'Sub'
  }

  return (
    <div
      className={`headingSelection ${isStyled ? 'is-active' : ''} join rounded-field border-base-300 flex h-9 min-w-32 items-center justify-between border px-1`}>
      <Button
        variant="ghost"
        size="xs"
        shape="square"
        className="join-item"
        onTouchEnd={() => changeHeadingLevel(-1)}
        disabled={headingLevel === 1 || isFirstBlock}
        startIcon={<Icons.minus size={20} />}
      />
      <span
        className="text-base-content flex min-h-8 min-w-8 cursor-pointer items-center justify-center px-1 text-sm font-semibold"
        onTouchEnd={toggleContentSectionLevel}>
        {centerLabel}
      </span>
      <Button
        variant="ghost"
        size="xs"
        shape="square"
        className="join-item"
        onTouchEnd={() => changeHeadingLevel(1)}
        disabled={headingLevel === 6 || isFirstBlock}
        startIcon={<Icons.plus size={20} />}
      />
    </div>
  )
}

export default HeadingSelection
