import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/Tooltip'
import SelectBox from '@components/ui/SelectBox'
import React, { useCallback } from 'react'

const SelectHeadingBox = ({ editor }) => {
  const options = [
    { value: 0, label: 'Normal Text' },
    { value: 1, label: 'Heading 1' },
    { value: 2, label: 'Heading 2' },
    { value: 3, label: 'Heading 3' },
    { value: 4, label: 'Heading 4' },
    { value: 5, label: 'Heading 5' },
    { value: 6, label: 'Heading 6' },
    { value: 7, label: 'Heading 7' },
    { value: 8, label: 'Heading 8' },
    { value: 9, label: 'Heading 9' },
    { value: 10, label: 'Heading 10' }
  ]
  const onHeadingChange = useCallback(
    (value) => {
      if (value === 0) editor.chain().focus().normalText().run()
      else editor.chain().focus().wrapBlock({ level: +value }).run()
    },
    [editor]
  )

  function getCurrentHeading(editor) {
    const selectedHeadingOption = options.find((option) => {
      return editor.isActive('contentHeading', { level: option.value })
    })

    return selectedHeadingOption?.value || options.at(0).value
  }

  return (
    <Tooltip placement="bottom">
      <TooltipTrigger asChild={true}>
        <SelectBox options={options} value={getCurrentHeading(editor)} onChange={onHeadingChange} />
      </TooltipTrigger>
      <TooltipContent className="Tooltip">Change Heading Level (⌘+⌥+0-9)</TooltipContent>
    </Tooltip>
  )
}

export default SelectHeadingBox
