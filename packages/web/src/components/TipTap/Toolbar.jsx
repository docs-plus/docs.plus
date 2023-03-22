import React, { useEffect, useState, useCallback } from 'react'
import Select from 'react-select'

import {
  Bold,
  Italic,
  Underline,
  OrderList,
  BulletList,
  Link,
  CheckList,
  Image,
  Gear,
  ClearMark,
  Stric,
  HighlightMarker,
  Undo,
  Redo,
  Printer
} from '../../components/icons/Icons'

const GearModal = (props) => {
  return (
    <div className='gearModal nd_modal'>
      {props.children}
    </div>
  )
}

const Toolbar = ({ editor }) => {
  if (!editor) {
    return null
  }

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

  useEffect(() => {
    if (editor.isActive('contentHeading', { level: 1 })) setSelectValue(options[1])
    else if (editor.isActive('contentHeading', { level: 2 })) setSelectValue(options[2])
    else if (editor.isActive('contentHeading', { level: 3 })) setSelectValue(options[3])
    else if (editor.isActive('contentHeading', { level: 4 })) setSelectValue(options[4])
    else if (editor.isActive('contentHeading', { level: 5 })) setSelectValue(options[5])
    else if (editor.isActive('contentHeading', { level: 6 })) setSelectValue(options[6])
    else if (editor.isActive('contentHeading', { level: 7 })) setSelectValue(options[7])
    else if (editor.isActive('contentHeading', { level: 8 })) setSelectValue(options[8])
    else if (editor.isActive('contentHeading', { level: 9 })) setSelectValue(options[9])
    else if (editor.isActive('contentHeading', { level: 10 })) setSelectValue(options[10])
    else setSelectValue(options[0])
  }, [
    editor.isActive('contentHeading', { level: 1 }),
    editor.isActive('contentHeading', { level: 2 }),
    editor.isActive('contentHeading', { level: 3 }),
    editor.isActive('contentHeading', { level: 4 }),
    editor.isActive('contentHeading', { level: 5 }),
    editor.isActive('contentHeading', { level: 6 }),
    editor.isActive('contentHeading', { level: 7 }),
    editor.isActive('contentHeading', { level: 8 }),
    editor.isActive('contentHeading', { level: 9 }),
    editor.isActive('contentHeading', { level: 10 }),
    editor.isActive('paragraph')
  ])

  const onchangeValue = (e) => {
    setSelectedOption(e)
    const value = e.value

    if (value === 0) editor.chain().focus().normalText().run()
    else editor.chain().focus().wrapBlock({ level: +value }).run()
  }

  let indentSetting = localStorage.getItem('setting.indentHeading')
  let h1SectionBreakSetting = localStorage.getItem('setting.h1SectionBreakSetting')

  if (indentSetting === undefined) {
    localStorage.setItem('setting.indentHeading', '')
    indentSetting = false
  }

  if (!indentSetting) {
    localStorage.setItem('setting.h1SectionBreakSetting', 'true')
    h1SectionBreakSetting = true
    document.body.classList.add('h1SectionBreak')
  }

  const [indented, setIndented] = React.useState(Boolean(indentSetting))
  const [h1SectionBreak, setH1SectionBreak] = React.useState(Boolean(h1SectionBreakSetting))

  const toggleHeadingIndent = (e) => {
    setIndented(preState => {
      const newState = !preState

      if (newState) { document.body.classList.add('indentHeading') } else { document.body.classList.remove('indentHeading') }

      localStorage.setItem('setting.indentHeading', newState ? 'yes' : '')

      return newState
    })
  }

  const toggleH1SectionBreak = (e) => {
    setH1SectionBreak(preState => {
      const newState = !preState

      if (newState) { document.body.classList.add('h1SectionBreak') } else { document.body.classList.remove('h1SectionBreak') }

      localStorage.setItem('setting.h1SectionBreakSetting', newState ? 'yes' : '')

      return newState
    })
  }

  const toggleSettingModal = () => {
    console.log('toggleSettingModal')
    document.querySelector('.gearModal').classList.toggle('active')
  }

  const hideModals = (e) => {
    console.log()
    if (e.target.closest('.btn_modal') || e.target.closest('.nd_modal')) return
    document.querySelector('.gearModal').classList.remove('active')
  }

  useEffect(() => {
    const newIndent = localStorage.getItem('setting.indentHeading')

    if (newIndent) return document.body.classList.add('indentHeading')
    document.body.classList.remove('indentHeading')
  }, [])

  return (
    <div className='tiptap__toolbar editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-4' onClick={hideModals}>

      <div className=' hidden sm:contents'>
        <button onClick={() => editor.chain().focus().undo().run()}>
          <Undo fill="rgba(0,0,0,.7)" size="16" />
        </button>
        <button onClick={() => editor.chain().focus().redo().run()}>
          <Redo fill="rgba(0,0,0,.7)" size="16" />
        </button>
        <button onClick={() => window.print()}>
          <Printer fill="rgba(0,0,0,.7)" size="16" />
        </button>
        <div className='divided'></div>
      </div>

      <Select
        className="w-32 text-sm"
        classNamePrefix="nodeStyle"
        defaultValue={options[0]}
        menuColor='red'
        menuPlacement="top"
        options={options}
        value={selectValue}
        onChange={onchangeValue}
      />

      <div className='divided'></div>

      <button
        className={editor.isActive('bold') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold fill="rgba(0,0,0,.7)" size="10" />
      </button>

      <button
        className={editor.isActive('italic') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic fill="rgba(0,0,0,.7)" size="10" />
      </button>

      <button
        className={editor.isActive('underline') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline fill="rgba(0,0,0,.7)" size="10" />
      </button>

      <span className='hidden sm:contents'>
        <button
          className={editor.isActive('strike') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Stric fill="rgba(0,0,0,.7)" size="14" />

        </button>

      </span>

      <div className='divided'></div>

      <button
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <OrderList fill="rgba(0,0,0,.7)" size="16" />

      </button>

      <button
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletList fill="rgba(0,0,0,.7)" size="16" />

      </button>

      <span className='hidden sm:contents'>

        <button
          className={editor.isActive('taskList') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckList fill="rgba(0,0,0,.7)" size="16" />
        </button>

      </span>

      <div className='divided'></div>

      <span className='hidden sm:contents'>

        <button onClick={addImage}>
          <Image fill="rgba(0,0,0,.5)" size="14" />
        </button>

      </span>

      <button className={editor.isActive('link') ? 'is-active' : ''} onClick={setLink}>
        <Link fill="rgba(0,0,0,.7)" size="18" />
      </button>

      <span className='hidden sm:contents'>
        <button
          className={editor.isActive('highlight') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <HighlightMarker fill="rgba(0,0,0,.7)" size="14" />
        </button>
      </span>

      <span className='hidden sm:contents'>

        <div className='divided'></div>

        <button onClick={() => {
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

      <button
        className='btn_settingModal btn_modal'
        onClick={toggleSettingModal}
      >
        <Gear fill="rgba(0,0,0,.7)" size="16" />
      </button>

      <GearModal>
        <p className='font-medium text-base text-gray-400 pb-1'>Settings:</p>
        <hr />
        <div className='content pt-5 '>
          <label className="inline-flex relative items-center cursor-pointer" htmlFor="headingIndent-toggle">
            <input checked={indented} className="sr-only peer"
              id="headingIndent-toggle" type="checkbox" value="" onChange={(e) => toggleHeadingIndent(e.target)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" > Toggle heading indent</span >
          </label >
        </div>
        <div className='content pt-5 '>
          <label className="inline-flex relative items-center cursor-pointer" htmlFor="h1sectionbreak-toggle">
            <input checked={h1SectionBreak} className="sr-only peer"
              id="h1sectionbreak-toggle" type="checkbox" value="" onChange={(e) => toggleH1SectionBreak(e.target)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" > Toggle H1 section break</span >
          </label >
        </div>
      </GearModal>

    </div >
  )
}

export default Toolbar
