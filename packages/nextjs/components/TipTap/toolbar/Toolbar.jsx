import { useEffect, useState, useCallback } from 'react'
import Select from 'react-select'
import { useRouter } from 'next/router'

import {
  Bold,
  Italic,
  Underline,
  OrderList,
  BulletList,
  Link,
  CheckList,
  ImageBox,
  Gear,
  ClearMark,
  Stric,
  HighlightMarker,
  Undo,
  Redo,
  Printer,
  Filter
} from '../../icons/Icons'

import FilterModal from './FilterModal'
import GearModal from './GearModal'

const Toolbar = ({ editor, docId, documentDescription = '', keywords = [] }) => {
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (editor.isActive('link')) {
      return editor.chain().focus().unsetLink().run()
    }

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()

      return
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

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

  return (
    <div
      className="tiptap__toolbar editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-4"
      onClick={hideModals}>
      <div className="hidden sm:contents">
        <button onClick={() => editor.chain().focus().undo().run()}>
          <Undo fill="rgba(0,0,0,.7)" size="16" />
        </button>
        <button onClick={() => editor.chain().focus().redo().run()}>
          <Redo fill="rgba(0,0,0,.7)" size="16" />
        </button>
        <button onClick={() => window.print()}>
          <Printer fill="rgba(0,0,0,.7)" size="16" />
        </button>
        <div className="divided"></div>
      </div>

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

      <button
        className={editor.isActive('bold') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold fill="rgba(0,0,0,.7)" size="10" />
      </button>

      <button
        className={editor.isActive('italic') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic fill="rgba(0,0,0,.7)" size="10" />
      </button>

      <button
        className={editor.isActive('underline') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline fill="rgba(0,0,0,.7)" size="10" />
      </button>

      <span className="hidden sm:contents">
        <button
          className={editor.isActive('strike') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Stric fill="rgba(0,0,0,.7)" size="14" />
        </button>
      </span>

      <div className="divided"></div>

      <button
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <OrderList fill="rgba(0,0,0,.7)" size="16" />
      </button>

      <button
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <BulletList fill="rgba(0,0,0,.7)" size="16" />
      </button>

      <span className="hidden sm:contents">
        <button
          className={editor.isActive('taskList') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <CheckList fill="rgba(0,0,0,.7)" size="16" />
        </button>
      </span>

      <div className="divided"></div>

      <span className="hidden sm:contents">
        <button onClick={addImage}>
          <ImageBox fill="rgba(0,0,0,.5)" size="14" />
        </button>
      </span>

      <button className={editor.isActive('link') ? 'is-active' : ''} onClick={setLink}>
        <Link fill="rgba(0,0,0,.7)" size="18" />
      </button>

      <span className="hidden sm:contents">
        <button
          className={editor.isActive('highlight') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <HighlightMarker fill="rgba(0,0,0,.7)" size="14" />
        </button>
      </span>

      <span className="hidden sm:contents">
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
      </span>

      <button className="btn_filterModal btn_modal" onClick={toggleFilterModal}>
        <Filter fill="rgba(0,0,0,.7)" size="20" />
      </button>

      <button className="btn_settingModal btn_modal" onClick={toggleSettingModal}>
        <Gear fill="rgba(0,0,0,.7)" size="16" />
      </button>
      <FilterModal totalHeading={totalHeading} />
      <GearModal documentDescription={documentDescription} keywords={keywords} docId={docId} />
    </div>
  )
}

export default Toolbar
