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

  const customStyles = {
    menu: (provided, state) => ({
      ...provided,
      width: state.selectProps.width,
      borderBottom: '1px dotted pink',
      color: state.selectProps.menuColor,
      padding: 20,
      borderColor: "red"
    }),
    menuPortal: (provided, state) => ({
      ...provided,
      padding: 0
    }),
    singleValue: (provided, state) => {
      const opacity = state.isDisabled ? 0.5 : 1;
      const transition = 'opacity 300ms';
      console.log(provided)
      return { ...provided, opacity, transition };
    },
    control: (styles) => {
      console.log(styles)

      return { ...styles, backgroundColor: '#ddd', borderWidth: 0, minHeight: 28, height: 28 }
    },
    dropdownIndicator: (styles) => {
      // console.log(styles)
      return {
        ...styles,
        // padding: "0"
      }
    },
    container: (styles) => {
      return {
        ...styles,
        minHeight: 28, height: 28,
        padding: 0
      }
    },
    valueContainer: (styles) => {
      return {
        ...styles,
        minHeight: 28, height: 28,
        padding: "0"
      }
    },

  }


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







    </div>
  );
}

export default Toolbar;
