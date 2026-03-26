import Select from '@components/ui/Select'
import { Tooltip } from '@components/ui/Tooltip'
import { Editor } from '@tiptap/core'
import { useCallback, useMemo } from 'react'

const BLOCK_STYLES = [
  { value: 'p', label: 'Normal Text' },
  { value: '1', label: 'Heading 1' },
  { value: '2', label: 'Heading 2' },
  { value: '3', label: 'Heading 3' },
  { value: '4', label: 'Heading 4' },
  { value: '5', label: 'Heading 5' },
  { value: '6', label: 'Heading 6' }
]

interface StyleSelectProps {
  editor: Editor
}

const StyleSelect = ({ editor }: StyleSelectProps) => {
  const currentValue = useMemo(() => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return String(i)
    }
    return 'p'
  }, [editor.state.selection])

  const handleChange = useCallback(
    (value: string) => {
      if (value === 'p') {
        editor.chain().focus().setParagraph().run()
      } else {
        editor
          .chain()
          .focus()
          .toggleHeading({ level: +value as 1 | 2 | 3 | 4 | 5 | 6 })
          .run()
      }
    },
    [editor]
  )

  return (
    <Tooltip title="Styles (⌘+⌥+[1-6])" placement="bottom">
      <div>
        <Select
          value={currentValue}
          onChange={handleChange}
          options={BLOCK_STYLES}
          ghost
          size="sm"
          wrapperClassName="w-auto"
          className="min-w-36"
        />
      </div>
    </Tooltip>
  )
}

export default StyleSelect
