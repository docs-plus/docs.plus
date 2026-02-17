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
  { value: '6', label: 'Heading 6' },
  { value: '7', label: 'Heading 7' },
  { value: '8', label: 'Heading 8' },
  { value: '9', label: 'Heading 9' },
  { value: '10', label: 'Heading 10' }
]

interface StyleSelectProps {
  editor: Editor
}

const StyleSelect = ({ editor }: StyleSelectProps) => {
  const currentValue = useMemo(() => {
    for (let i = 1; i <= 10; i++) {
      if (editor.isActive('contentHeading', { level: i })) return String(i)
    }
    return 'p'
  }, [editor.state.selection])

  const handleChange = useCallback(
    (value: string) => {
      if (value === 'p') {
        editor.chain().focus().normalText().run()
      } else {
        editor.chain().focus().wrapBlock({ level: +value }).run()
      }
    },
    [editor]
  )

  return (
    <Tooltip title="Styles (⌘+⌥+[0-9])" placement="bottom">
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
