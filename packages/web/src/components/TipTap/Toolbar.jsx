import React, { useEffect, useState, useCallback } from 'react'
import {
  Bold,
  Italic,
  Underline,
  OrderList,
  BulletList,
  Link,
  UnLink,
  CheckList,
  Plus,
  AddComment,
  Video,
  Image,
  Gear,
  OfflineCloud,
  Doc,
  PrivateShare,
  ClearMark,
  Stric,
  HighlightMarker,
  Undo,
  Redo,
  Printer,
} from '../../components/icons/Icons'
import Select from 'react-select';
// import {
//   Bold
//  } from "../icons/icons";

import Button from '../ui/Button'

// import { ReactComponent as Logo } from '../../assets/icons/Bold.svg'

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
    { value: 1, label: 'Title' },
    { value: 2, label: 'Heading 1' },
    { value: 3, label: 'Heading 2' },
    { value: 4, label: 'Heading 3' },
    { value: 5, label: 'Heading 4' },
    { value: 6, label: 'Heading 5' },
  ];

  const [selectedOption, setSelectedOption] = useState(options[0]);
  const [selectValue, setSelectValue] = useState(options[0])


  useEffect(() => {
    if (editor.isActive('heading', { level: 1 })) setSelectValue(options[1])
    else if (editor.isActive('heading', { level: 2 })) setSelectValue(options[2])
    else if (editor.isActive('heading', { level: 3 })) setSelectValue(options[3])
    else if (editor.isActive('heading', { level: 4 })) setSelectValue(options[4])
    else if (editor.isActive('heading', { level: 5 })) setSelectValue(options[5])
    else if (editor.isActive('heading', { level: 6 })) setSelectValue(options[6])
    else setSelectValue(options[0])
  }, [
    editor.isActive('heading', { level: 1 }),
    editor.isActive('heading', { level: 2 }),
    editor.isActive('heading', { level: 3 }),
    editor.isActive('heading', { level: 4 }),
    editor.isActive('heading', { level: 5 }),
    editor.isActive('heading', { level: 6 }),
    editor.isActive('paragraph')
  ])


  const onchangeValue = (e) => {
    setSelectedOption(e)
    const value = e.value
    if (value === 0) editor.chain().focus().setParagraph().run()
    else editor.chain().focus().toggleHeading({ level: +value }).run()
  }

  // const customStyles = {
  //   menu: (provided, state) => ({
  //     ...provided,
  //     width: state.selectProps.width,
  //     borderBottom: '1px dotted pink',
  //     color: state.selectProps.menuColor,
  //     padding: 20,
  //     borderColor: "red"
  //   }),
  //   menuPortal: (provided, state) => ({
  //     ...provided,
  //     padding: 0
  //   }),
  //   singleValue: (provided, state) => {
  //     const opacity = state.isDisabled ? 0.5 : 1;
  //     const transition = 'opacity 300ms';
  //     console.log(provided)
  //     return { ...provided, opacity, transition };
  //   },
  //   control: (styles) => {
  //     console.log(styles)

  //     return { ...styles, backgroundColor: '#ddd', borderWidth: 0, minHeight: 28, height: 28 }
  //   },
  //   dropdownIndicator: (styles) => {
  //     // console.log(styles)
  //     return {
  //       ...styles,
  //       // padding: "0"
  //     }
  //   },
  //   container: (styles) => {
  //     return {
  //       ...styles,
  //       minHeight: 28, height: 28,
  //       padding: 0
  //     }
  //   },
  //   valueContainer: (styles) => {
  //     return {
  //       ...styles,
  //       minHeight: 28, height: 28,
  //       padding: "0"
  //     }
  //   },

  // }

  let indentSetting = localStorage.getItem('setting.indentHeading')

  if (indentSetting === undefined) {
    localStorage.setItem('setting.indentHeading', '')
    indentSetting = false

  } else {
    // console.log('=new', indentSetting)
    // setIndented(indentSetting)
  }

  // console.log("indentSetting", indentSetting, Boolean(indentSetting))

  const [indented, setIndented] = React.useState(Boolean(indentSetting));


  const toggleHeadingIndent = (e) => {
    setIndented(preState => {
      const newState = !preState

      if (newState)
        document.body.classList.add("indentHeading")
      else
        document.body.classList.remove("indentHeading")

      localStorage.setItem('setting.indentHeading', newState ? 'yes' : '')

      return newState
    })
  }

  useEffect(() => {
    const newIndent = localStorage.getItem('setting.indentHeading')
    if (Boolean(newIndent)) return document.body.classList.add("indentHeading")
    document.body.classList.remove("indentHeading")
  }, [])


  return (
    <div className='tiptap__toolbar editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-3'>

      <div className=' hidden sm:contents'>
        <button onClick={() => editor.chain().focus().undo().run()}>
          <Undo size="16" fill="rgba(0,0,0,.7)" />
        </button>
        <button onClick={() => editor.chain().focus().redo().run()}>
          <Redo size="16" fill="rgba(0,0,0,.7)" />
        </button>
        <button onClick={() => window.print()}>
          <Printer size="16" fill="rgba(0,0,0,.7)" />
        </button>
        <div className='divided'></div>
      </div>

      <Select
        // styles={customStyles}
        defaultValue={options[0]}
        onChange={onchangeValue}
        options={options}
        value={selectValue}
        menuColor='red'
        className="w-28 text-sm"
        classNamePrefix="nodeStyle"
        menuPlacement="top"
      />

      <div className='divided'></div>


      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
      >
        <Bold size="10" fill="rgba(0,0,0,.7)" />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
      >
        <Italic size="10" fill="rgba(0,0,0,.7)" />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? 'is-active' : ''}
      >
        <Underline size="10" fill="rgba(0,0,0,.7)" />
      </button>

      <span className='hidden sm:contents'>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
        >
          <Stric size="14" fill="rgba(0,0,0,.7)" />

        </button>

      </span>



      <div className='divided'></div>



      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
      >
        <OrderList size="16" fill="rgba(0,0,0,.7)" />

      </button>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
      >
        <BulletList size="16" fill="rgba(0,0,0,.7)" />

      </button>

      <span className='hidden sm:contents'>


        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive('taskList') ? 'is-active' : ''}
        >
          <CheckList size="16" fill="rgba(0,0,0,.7)" />
        </button>

      </span>

      <div className='divided'></div>

      <span className='hidden sm:contents'>

        <button onClick={addImage}>
          <Image size="14" fill="rgba(0,0,0,.5)" />
        </button>

      </span>

      <button onClick={setLink} className={editor.isActive('link') ? 'is-active' : ''}>
        <Link size="18" fill="rgba(0,0,0,.7)" />
      </button>

      <span className='hidden sm:contents'>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={editor.isActive('highlight') ? 'is-active' : ''}
        >
          <HighlightMarker size="14" fill="rgba(0,0,0,.7)" />
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
          <ClearMark size="14" fill="rgba(0,0,0,.7)" />
        </button>

      </span>


      <div className='divided'></div>

      <button
        onClick={() => editor.chain().focus().normalText().run()}
      // className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
      >
        P
      </button>

      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
      >
        W1
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
      >
        W2
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
      >
        W3
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 4 }).run()}
        className={editor.isActive('heading', { level: 4 }) ? 'is-active' : ''}
      >
        W4
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 5 }).run()}
        className={editor.isActive('heading', { level: 5 }) ? 'is-active' : ''}
      >
        W5
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 6 }).run()}
        className={editor.isActive('heading', { level: 6 }) ? 'is-active' : ''}
      >
        W6
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 7 }).run()}
        className={editor.isActive('heading', { level: 7 }) ? 'is-active' : ''}
      >
        W7
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 8 }).run()}
        className={editor.isActive('heading', { level: 8 }) ? 'is-active' : ''}
      >
        W8
      </button>
      <button
        onClick={() => editor.chain().focus().wrapBlock({ level: 9 }).run()}
        className={editor.isActive('heading', { level: 9 }) ? 'is-active' : ''}
      >
        W9
      </button>

      <div className='divided'></div>

      <label htmlFor="default-toggle" className="inline-flex relative items-center cursor-pointer">
        <input type="checkbox" checked={indented}
          onChange={(e) => toggleHeadingIndent(e.target)} value="" id="default-toggle" className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" > Toggle heading indent</span >
      </label >

      <div className='divided'></div>
    </div >
  );
}

export default Toolbar;
