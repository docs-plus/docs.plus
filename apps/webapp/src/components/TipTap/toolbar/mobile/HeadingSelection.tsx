import { setParagraphStyle } from '@components/TipTap/extensions/paragraph-style/commands'
import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useState } from 'react'

import ToolbarButton from '../ToolbarButton'

interface HeadingSelectionProps {
  editor: Editor
}

type SectionKind = 'heading' | 'p' | 'subtitle'

/** One first-block guard so the disabled UI and the no-op commands agree. `$from.before(1)` (top-level
 *  ancestor) is safe only because the first block is always the non-nestable Title heading (depth 1). */
const isFirstBlockSelected = (editor: Editor) => editor.state.selection.$from.before(1) === 0

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
      if (isFirstBlockSelected(editor)) return

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
    if (isFirstBlockSelected(editor)) return

    if (activeSectionType === 'subtitle' || activeSectionType === 'p') {
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

  const isFirstBlock = isFirstBlockSelected(editor)
  const isStyled = activeSectionType === 'heading' || activeSectionType === 'subtitle'

  let centerLabel = `H${headingLevel}`
  if (isFirstBlock && activeSectionType === 'heading' && headingLevel === 1) {
    centerLabel = 'Title'
  } else if (activeSectionType === 'subtitle') {
    centerLabel = 'Sub'
  }

  return (
    <div
      className={`headingSelection ${isStyled ? 'is-active' : ''} rounded-field border-base-300 flex h-11 items-center gap-1.5 border pr-1 pl-0.5`}>
      <ToolbarButton
        shape={null}
        onPress={toggleContentSectionLevel}
        aria-label={`Block type: ${centerLabel}. Change.`}
        className="headingSelection__label rounded-field h-9 min-h-9 min-w-11 border-0 px-2 text-sm font-semibold">
        {centerLabel}
      </ToolbarButton>

      <div
        className="headingSelection__seg border-base-300 rounded-field flex h-9 items-stretch overflow-hidden border"
        role="group"
        aria-label="Heading level">
        <ToolbarButton
          shape={null}
          onPress={() => changeHeadingLevel(-1)}
          disabled={headingLevel === 1 || isFirstBlock}
          aria-label="Decrease heading level"
          className="h-9 min-h-9 w-11 rounded-none border-0">
          <Icons.minus size={20} />
        </ToolbarButton>
        <ToolbarButton
          shape={null}
          onPress={() => changeHeadingLevel(1)}
          disabled={headingLevel === 6 || isFirstBlock}
          aria-label="Increase heading level"
          className="headingSelection__plus border-base-300 h-9 min-h-9 w-11 rounded-none border-0 border-l">
          <Icons.plus size={20} />
        </ToolbarButton>
      </div>
    </div>
  )
}

// NOT memoized on purpose: `centerLabel`/stepper-disabled read live editor state at render
// (`isFirstBlockSelected`), which isn't in props — so it must re-render on every transaction via the
// parent's `useReRenderOnEditorTransaction`. Memoizing leaves those stale when moving between two
// same-level headings (state unchanged, but first-block-ness flips).
export default HeadingSelection
