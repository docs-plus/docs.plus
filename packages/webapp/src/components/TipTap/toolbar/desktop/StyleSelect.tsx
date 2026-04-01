import { setParagraphStyle } from '@components/TipTap/extensions/paragraph-style/commands'
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

const StyleSelect = ({ editor }: StyleSelectProps) => {
  const { $from } = editor.state.selection
  const isFirstBlock = $from.before(1) === 0

  let currentValue = 'p'
  if (editor.isActive('paragraph', { paragraphStyle: 'subtitle' })) {
    currentValue = 'subtitle'
  } else {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) {
        currentValue = String(i)
        break
      }
    }
  }

  const handleChange = useCallback(
    (value: string) => {
      if (value === 'p') {
        setParagraphStyle(editor, 'normal')
      } else if (value === 'subtitle') {
        setParagraphStyle(editor, 'subtitle')
      } else {
        const level = +value as 1 | 2 | 3 | 4 | 5 | 6
        editor.chain().focus().setHeading({ level }).run()
      }
    },
    [editor]
  )

  if (isFirstBlock) {
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
          value={currentValue}
          onChange={handleChange}
          options={BODY_STYLE_OPTIONS}
          ghost
          size="sm"
          wrapperClassName="w-full min-w-0 max-w-full"
          className={twMerge('min-w-0', currentValue !== 'p' && 'is-active')}
        />
      </Tooltip>
    </div>
  )
}

export default StyleSelect
