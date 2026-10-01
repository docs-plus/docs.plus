import {
  applyBlockStyle,
  type BlockStyle,
  isHeadingLevel,
  readBlockStyle
} from '@components/TipTap/block-style/blockStyle'
import Select from '@components/ui/Select'
import { Tooltip } from '@components/ui/Tooltip'
import { Editor } from '@tiptap/core'
import { twMerge } from '@utils/twMerge'
import { useCallback } from 'react'

interface StyleSelectProps {
  editor: Editor
}

const BODY_STYLE_OPTIONS = [
  { value: 'p', label: 'Normal text' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: '1', label: 'Heading 1' },
  { value: '2', label: 'Heading 2' },
  { value: '3', label: 'Heading 3' },
  { value: '4', label: 'Heading 4' },
  { value: '5', label: 'Heading 5' },
  { value: '6', label: 'Heading 6' }
]

const TITLE_OPTIONS = [{ value: 'title', label: 'Document title' }]

const selectValue = (style: Exclude<BlockStyle, { kind: 'title' }>): string => {
  switch (style.kind) {
    case 'subtitle':
      return 'subtitle'
    case 'heading':
      return String(style.level)
    case 'normal':
      return 'p'
    default: {
      const _exhaustive: never = style
      return _exhaustive
    }
  }
}

const StyleSelect = ({ editor }: StyleSelectProps) => {
  const style = readBlockStyle(editor)

  const handleChange = useCallback(
    (value: string) => {
      if (value === 'p') {
        applyBlockStyle(editor, { kind: 'normal' })
        return
      }
      if (value === 'subtitle') {
        applyBlockStyle(editor, { kind: 'subtitle' })
        return
      }
      const level = Number(value)
      if (isHeadingLevel(level)) applyBlockStyle(editor, { kind: 'heading', level })
    },
    [editor]
  )

  const isTitle = style.kind === 'title'

  // Fixed width, so the slot does not grow with the label (Normal text vs Heading 1).
  // The first line is always the Title: a disabled one-option Select shows the lock.
  // Select takes no ref, so the span is the Tooltip anchor. On the Title line the
  // disabled trigger drops pointer events, so hover reaches the span.
  return (
    <div className="w-40 max-w-40 min-w-0 shrink-0">
      <Tooltip
        title={isTitle ? 'Document name — always the first line' : 'Styles (⌘+⌥+[1-6])'}
        placement="top">
        <span className="block w-full min-w-0">
          <Select
            value={isTitle ? 'title' : selectValue(style)}
            onChange={handleChange}
            options={isTitle ? TITLE_OPTIONS : BODY_STYLE_OPTIONS}
            disabled={isTitle}
            ghost
            size="sm"
            wrapperClassName={twMerge(
              'w-full min-w-0 max-w-full',
              isTitle && 'pointer-events-none'
            )}
            className={twMerge('min-w-0', style.kind !== 'normal' && 'is-active')}
          />
        </span>
      </Tooltip>
    </div>
  )
}

export default StyleSelect
