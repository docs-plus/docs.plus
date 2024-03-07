import SelectBox from '@components/ui/SelectBox'
import React, { useCallback } from 'react'

const SelectHeadingBox = ({ editor }: any) => {
  const options = [
    { value: 'p', label: 'Normal Text', className: 'text-[14px]' },
    { value: 1, label: 'Heading 1', className: 'text-[20px]' },
    { value: 2, label: 'Heading 2', className: 'text-[18px]' },
    { value: 3, label: 'Heading 3', className: 'text-[17px]' },
    { value: 4, label: 'Heading 4', className: 'text-[16px]' },
    { value: 5, label: 'Heading 5', className: 'text-[15px]' },
    { value: 6, label: 'Heading 6', className: 'text-[14px]' }
  ]

  const restOptions = [
    { value: 7, label: 'Heading 7', className: 'text-[13px]' },
    { value: 8, label: 'Heading 8', className: 'text-[13px]' },
    { value: 9, label: 'Heading 9', className: 'text-[13px]' },
    { value: 10, label: 'Heading 10', className: 'text-[13px]' }
  ]

  const subOptions = {
    summary: 'More',
    options: restOptions
  }

  const onHeadingChange = useCallback(
    (value: string) => {
      if (value === 'p') {
        editor.chain().focus().normalText().run()
      } else {
        editor.chain().focus().wrapBlock({ level: +value }).run()
      }
    },
    [editor]
  )

  function getCurrentHeading(editor: any): any {
    const newOptions = [...options, ...restOptions]
    const selectedHeadingOption = newOptions.find((option) => {
      return editor.isActive('contentHeading', { level: option.value })
    })

    return selectedHeadingOption || newOptions.at(0)
  }

  return (
    <div className="tooltip tooltip-bottom" data-tip="Heading Level (⌘+⌥+0-9)">
      <div className="!w-36 !max-w-36  ">
        <SelectBox
          options={options}
          subOptions={subOptions}
          value={getCurrentHeading(editor)}
          onChange={onHeadingChange}
        />
      </div>
    </div>
  )
}

export default SelectHeadingBox
