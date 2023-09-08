import React, { useEffect, useState, useCallback } from 'react'
import Select from 'react-select'
import { Link, ImageBox, Gear, ClearMark, Filter, Folder } from '@icons'
import dynamic from 'next/dynamic'
import ToolbarButton from './ToolbarButton'
import Icon from './Icon'
import FilterModal from './FilterModal'
import { useRouter } from 'next/router'
import { useEditorStateContext } from '@context/EditorContext'
import { Popover, PopoverTrigger } from '@components/ui/Popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/Tooltip'
import { Dialog, DialogTrigger, DialogContent } from '@components/ui/Dialog'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <div>Loading...</div>
})
const GearModal = dynamic(() => import('./GearModal'))

const Toolbar = ({ editor, docMetadata }) => {
  const router = useRouter()
  const { isAuthServiceAvailable } = useEditorStateContext()

  const addImage = useCallback(() => {
    const url = window.prompt('URL')

    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

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

  const [selectValue, setSelectValue] = useState(options[0])
  const [totalHeading, setTotalHeading] = useState(0)

  useEffect(() => {
    const selectedHeadingOption = options.find((option) =>
      editor.isActive('contentHeading', { level: option.value })
    )

    setSelectValue(selectedHeadingOption || options.at(0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.isActive('contentHeading')])

  const onchangeValue = (e) => {
    const value = e.value

    if (value === 0) editor.chain().focus().normalText().run()
    else editor.chain().focus().wrapBlock({ level: +value }).run()
  }

  // const openControlCenter = () => {
  //   router.replace(`#panel=documents`)
  //   PubSub.publish('toggleControlCenter', true)
  // }

  return (
    <div className="tiptap__toolbar editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-4">
      {/* <ToolbarButton onClick={() => editor.chain().focus().undo().run()} editor={editor} type="undo">
        <Icon type="Undo" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} editor={editor} type="redo">
        <Icon type="Redo" size="16" />
      </ToolbarButton> */}

      {/* <Tooltip placement="bottom"> */}
      {/* <TooltipTrigger asChild={true}> */}
      <Select
        className="w-32 text-sm"
        classNamePrefix="nodeStyle"
        defaultValue={options[0]}
        menuColor="red"
        menuPlacement="top"
        options={options}
        value={selectValue}
        onChange={onchangeValue}
      />
      {/* </TooltipTrigger> */}
      {/* <TooltipContent className="Tooltip"> */}
      {/* Change Heading Level (⌘+⌥+0-9) */}
      {/* </TooltipContent> */}
      {/* </Tooltip> */}

      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        editor={editor}
        tooltip="Bold (⌘+B)"
        type="bold">
        <Icon type="Bold" size="10" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        editor={editor}
        tooltip="Italic (⌘+I)"
        type="italic">
        <Icon type="Italic" size="10" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        editor={editor}
        tooltip="Underline (⌘+U)"
        type="underline">
        <Icon type="Underline" size="10" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        editor={editor}
        tooltip="Strike (⌘+S)"
        type="strike">
        <Icon type="Stric" size="14" />
      </ToolbarButton>

      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        editor={editor}
        tooltip="Ordered List (⌘+⇧+7)"
        type="orderedList">
        <Icon type="OrderList" size="16" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        editor={editor}
        tooltip="Bullet List (⌘+⇧+8)"
        type="bulletList">
        <Icon type="BulletList" size="16" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        editor={editor}
        tooltip="Task List (⌘+⇧+9)"
        type="taskList">
        <Icon type="CheckList" size="16" />
      </ToolbarButton>

      <div className="divided"></div>

      <button onClick={addImage}>
        <ImageBox fill="rgba(0,0,0,.5)" size="14" />
      </button>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHyperlink().run()}
        editor={editor}
        tooltip="Hyperlink (⌘+K)"
        type="hyperlink">
        <Link fill="rgba(0,0,0,.7)" size="18" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        editor={editor}
        tooltip="Highlight (⌘+H)"
        type="highlight">
        <Icon type="HighlightMarker" size="14" />
      </ToolbarButton>

      <div className="divided"></div>

      <button
        onClick={() => {
          const range = editor.view.state.selection.ranges[0]

          if (range.$from === range.$to) {
            editor.chain().focus().clearNodes().run()
          } else {
            editor.chain().focus().unsetAllMarks().run()
          }
        }}>
        <ClearMark fill="rgba(0,0,0,.7)" size="14" />
      </button>

      <div className="ml-auto flex align-baseline items-center">
        <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)">
          <Icon type="Printer" size="16" />
        </ToolbarButton>

        {isAuthServiceAvailable && (
          <Dialog>
            <DialogTrigger>
              <Folder fill="rgba(0,0,0,.7)" size="18" />
            </DialogTrigger>
            <DialogContent>
              <ControlCenter />
            </DialogContent>
          </Dialog>
        )}
        <div className="divided"></div>

        <Popover>
          <PopoverTrigger>
            <Filter fill="rgba(0,0,0,.7)" size="20" />
          </PopoverTrigger>
          <FilterModal totalHeading={totalHeading} className="z-50" />
        </Popover>

        <Popover>
          <PopoverTrigger>
            <Gear fill="rgba(0,0,0,.7)" size="16" />
          </PopoverTrigger>
          <GearModal docMetadata={docMetadata} className="z-50" />
        </Popover>
      </div>
    </div>
  )
}

export default React.memo(Toolbar)
