import {
  type BlockStyle,
  type HeadingLevel,
  headingStepHonesty,
  readBlockStyle,
  stepHeadingLevel,
  toggleHeadingParagraph
} from '@components/TipTap/block-style/blockStyle'
import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import { useRef } from 'react'

import ToolbarButton from '../ToolbarButton'

interface HeadingSelectionProps {
  editor: Editor
}

const mobileLabel = (style: BlockStyle): string => {
  switch (style.kind) {
    case 'title':
      return 'Title'
    case 'subtitle':
      return 'Sub'
    case 'heading':
      return `H${style.level}`
    case 'normal':
      return 'N'
    default: {
      const _exhaustive: never = style
      return _exhaustive
    }
  }
}

const HeadingSelection = ({ editor }: HeadingSelectionProps) => {
  const style = readBlockStyle(editor)
  const rememberedLevel = useRef<HeadingLevel>(1)
  if (style.kind === 'heading') rememberedLevel.current = style.level

  const isTitle = style.kind === 'title'
  const { canStepDown, canStepUp } = headingStepHonesty(style)
  const centerLabel = mobileLabel(style)

  return (
    <div
      className={
        style.kind === 'normal'
          ? 'headingSelection join rounded-field border-base-300 min-h-11 border'
          : 'headingSelection join rounded-field border-base-300 is-active min-h-11 border'
      }
      role="group"
      aria-label="Heading level">
      <ToolbarButton
        shape={null}
        onPress={() => {
          editor.view.focus()
          toggleHeadingParagraph(editor, rememberedLevel.current)
        }}
        disabled={isTitle}
        aria-label={
          isTitle
            ? 'Document title. First line. Cannot change.'
            : `Block type: ${centerLabel}. Change.`
        }
        className="headingSelection__label join-item h-11 min-h-11 min-w-[3.25rem] border-0 px-1 text-sm font-medium tabular-nums disabled:opacity-100">
        {centerLabel}
      </ToolbarButton>

      <ToolbarButton
        shape={null}
        onPress={() => stepHeadingLevel(editor, -1)}
        disabled={!canStepDown}
        aria-label="Decrease heading level"
        className="headingSelection__step join-item h-11 min-h-11 w-11 border-0 disabled:opacity-100">
        <Icons.minus size={20} className="stroke-[1.75]" />
      </ToolbarButton>

      <ToolbarButton
        shape={null}
        onPress={() => stepHeadingLevel(editor, 1)}
        disabled={!canStepUp}
        aria-label="Increase heading level"
        className="headingSelection__step join-item h-11 min-h-11 w-11 border-0 disabled:opacity-100">
        <Icons.plus size={20} className="stroke-[1.75]" />
      </ToolbarButton>
    </div>
  )
}

// NOT memoized on purpose: Block style is read live from the editor, which is not in
// props. The parent re-renders this on every transaction via `useReRenderOnEditorTransaction`.
export default HeadingSelection
