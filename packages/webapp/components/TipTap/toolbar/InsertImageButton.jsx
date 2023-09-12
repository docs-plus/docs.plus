import { Popover, PopoverTrigger, PopoverContent } from '@components/ui/Popover'
import React, { useState, useCallback } from 'react'
import { ImageBox } from '@icons'
import Button from '@components/ui/Button'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import ToolbarButton from './ToolbarButton'

const InsertImageButton = ({ editor }) => {
  const addImage = useCallback(() => {
    const url = window.prompt('URL')

    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  function HyperlinkForm({ onSubmit }) {
    const [value, setValue] = useState('')

    return (
      <form
        className="bg-white border border-gray-100 flex flex-col p-2 w-96 rounded-md shadow-md z-50"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value)
        }}>
        <div className="w-full flex justify-between items-center">
          <InputOverlapLabel
            className="w-8/12"
            label="Image URL..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button className="w-4/12 ml-2">Add Link</Button>
        </div>
      </form>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild={true}>
        <ToolbarButton tooltip="Insert Image">
          <ImageBox fill="rgba(0,0,0,.7)" size="14" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="z-50">
        <HyperlinkForm variant="youtube" onSubmit={addImage} />
      </PopoverContent>
    </Popover>
  )
}

export default InsertImageButton
