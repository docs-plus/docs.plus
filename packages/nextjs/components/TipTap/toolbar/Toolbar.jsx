import { useEffect, useState, useCallback } from 'react'
import Select from 'react-select'

import { Link, ImageBox, Gear, ClearMark, Filter, Folder } from '@icons'
import PubSub from 'pubsub-js'

import ToolbarButton from './ToolbarButton'
import Icon from './Icon'

import FilterModal from './FilterModal'
import GearModal from './GearModal'
import { useRouter } from 'next/router'

const Toolbar = ({ editor, docMetadata }) => {
  const router = useRouter()

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

  const [selectedOption, setSelectedOption] = useState(options[0])
  const [selectValue, setSelectValue] = useState(options[0])
  const [totalHeading, setTotalHeading] = useState(0)

  useEffect(() => {
    const selectedHeadingOption = options.find((option) => editor.isActive('contentHeading', { level: option.value }))

    setSelectValue(selectedHeadingOption || options.at(0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.isActive('contentHeading')])

  const onchangeValue = (e) => {
    setSelectedOption(e)
    const value = e.value

    if (value === 0) editor.chain().focus().normalText().run()
    else editor.chain().focus().wrapBlock({ level: +value }).run()
  }

  const toggleSettingModal = (e) => {
    hideAllModals('gearModal')

    const gearModal = document.querySelector('.gearModal')
    gearModal.classList.toggle('active')
  }
  const toggleFilterModal = (e) => {
    hideAllModals('filterModal')

    const filterModal = document.querySelector('.filterModal')
    const headings = document.querySelectorAll('.title')

    setTotalHeading(headings.length)
    filterModal.classList.toggle('active')
    // filterSearchRef.current.focus()
  }

  const hideAllModals = (target) => {
    if (target === 'gearModal') document.querySelector('.filterModal').classList.remove('active')
    if (target === 'filterModal') document.querySelector('.gearModal').classList.remove('active')
  }

  const hideModals = (e) => {
    if (e.target.closest('.btn_modal') || e.target.closest('.nd_modal')) return
    document.querySelector('.gearModal').classList.remove('active')
    document.querySelector('.filterModal').classList.remove('active')
  }

  const openControlCenter = () => {
    router.replace(`#panel=documents`)
    PubSub.publish('toggleControlCenter', true)
  }

  return (
    <div
      className="tiptap__toolbar editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-4"
      onClick={hideModals}>
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} editor={editor} type="undo">
        <Icon type="Undo" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} editor={editor} type="redo">
        <Icon type="Redo" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => window.print()}>
        <Icon type="Printer" size="16" />
      </ToolbarButton>

      <div className="divided"></div>

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

      <div className="divided"></div>

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} editor={editor} type="bold">
        <Icon type="Bold" size="10" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} editor={editor} type="italic">
        <Icon type="Italic" size="10" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} editor={editor} type="underline">
        <Icon type="Underline" size="10" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} editor={editor} type="strike">
        <Icon type="Stric" size="14" />
      </ToolbarButton>

      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        editor={editor}
        type="orderedList">
        <Icon type="OrderList" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} editor={editor} type="bulletList">
        <Icon type="BulletList" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} editor={editor} type="taskList">
        <Icon type="CheckList" size="16" />
      </ToolbarButton>

      <div className="divided"></div>

      <button onClick={addImage}>
        <ImageBox fill="rgba(0,0,0,.5)" size="14" />
      </button>

      <ToolbarButton onClick={() => editor.chain().focus().setHyperlink().run()} editor={editor} type="hyperlink">
        <Link fill="rgba(0,0,0,.7)" size="18" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} editor={editor} type="highlight">
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
        <button onClick={openControlCenter}>
          <Folder fill="rgba(0,0,0,.7)" size="18" />
        </button>

        <div className="divided"></div>

        <button className="btn_filterModal btn_modal" onClick={toggleFilterModal}>
          <Filter fill="rgba(0,0,0,.7)" size="20" />
        </button>

        <button className="btn_settingModal btn_modal" onClick={toggleSettingModal}>
          <Gear fill="rgba(0,0,0,.7)" size="16" />
        </button>
      </div>

      <FilterModal totalHeading={totalHeading} />
      <GearModal docMetadata={docMetadata} />
    </div>
  )
}

export default Toolbar
