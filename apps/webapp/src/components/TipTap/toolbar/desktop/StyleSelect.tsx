import {
  applyBlockStyle,
  type BlockStyle,
  isHeadingLevel,
  readBlockStyle
} from '@components/TipTap/block-style/blockStyle'
import Select from '@components/ui/Select'
import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'
import { Editor } from '@tiptap/core'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface StyleSelectProps {
  editor: Editor
}

/** Matches Select trigger (`Select.tsx`); keep in sync for the non-dropdown “Document title” row. */
const SELECT_TRIGGER_CLASS =
  'select select-ghost select-sm flex w-full min-w-0 items-center justify-between bg-none pr-3 pl-3 text-left'

/** Fixed width so the toolbar slot does not grow with flex or with label length (Normal vs Heading 1). */
const SELECT_SLOT_CLASS = 'w-40 max-w-40 shrink-0 min-w-0'

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

  if (style.kind === 'title') {
    return (
      <div className={SELECT_SLOT_CLASS}>
        <Tooltip title="Document name — always the first line" placement="bottom">
          <div
            role="group"
            aria-label="Document title — first line of the document"
            className={twMerge(SELECT_TRIGGER_CLASS, 'is-active pointer-events-none select-none')}>
            <span className="min-w-0 flex-1 truncate" aria-hidden="true">
              Document title
            </span>
            <Icons.chevronDown
              size={16}
              className="text-base-content/50 shrink-0 opacity-50"
              aria-hidden
            />
          </div>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={SELECT_SLOT_CLASS}>
      <Tooltip title="Styles (⌘+⌥+[1-6])" placement="bottom">
        <Select
          value={selectValue(style)}
          onChange={handleChange}
          options={BODY_STYLE_OPTIONS}
          ghost
          size="sm"
          wrapperClassName="w-full min-w-0 max-w-full"
          className={twMerge('min-w-0', style.kind !== 'normal' && 'is-active')}
        />
      </Tooltip>
    </div>
  )
}

export default StyleSelect
