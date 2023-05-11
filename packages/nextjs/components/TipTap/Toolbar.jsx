import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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
  Filter,
} from '../../components/icons/Icons'

const GearModal = (props) => {
  return <div className="gearModal nd_modal">{props.children}</div>
}
const FilterModal = (props) => {
  return <div className="filterModal nd_modal">{props.children}</div>
}

const Toolbar = ({ editor }) => {
  const router = useRouter()

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
    { value: 10, label: 'Heading 10' },
  ]

  const [selectedOption, setSelectedOption] = useState(options[0])
  const [selectValue, setSelectValue] = useState(options[0])
  const [totalHeading, setTotalHeading] = useState(0)
  const [totalSearch, setTotalSearch] = useState(0)
  const filterSearchRef = useRef(null)

  useEffect(() => {
    const selectedHeadingOption = options.find((option) =>
      editor.isActive('contentHeading', { level: option.value })
    )

    setSelectValue(selectedHeadingOption || options.at(0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.isActive('contentHeading')])

  const onchangeValue = (e) => {
    setSelectedOption(e)
    const value = e.value

    if (value === 0) editor.chain().focus().normalText().run()
    else editor.chain().focus().wrapBlock({ level: +value }).run()
  }

  const getLocalStorageBoolean = (key, defaultValue) => {
    const value = localStorage.getItem(key)
    return value !== null ? value === 'true' : defaultValue
  }

  const setLocalStorageBoolean = (key, value) => {
    localStorage.setItem(key, value.toString())
  }

  const useBooleanLocalStorageState = (key, defaultValue) => {
    const [state, setState] = useState(() =>
      getLocalStorageBoolean(key, defaultValue)
    )

    const updateState = (newValue) => {
      setState(newValue)
      setLocalStorageBoolean(key, newValue)
    }

    return [state, updateState]
  }

  const [indentSetting, setIndentSetting] = useBooleanLocalStorageState(
    'setting.indentHeading',
    false
  )
  const [h1SectionBreakSetting, setH1SectionBreakSetting] =
    useBooleanLocalStorageState('setting.h1SectionBreakSetting', true)

  useEffect(() => {
    if (h1SectionBreakSetting) {
      document.body.classList.add('h1SectionBreak')
    } else {
      document.body.classList.remove('h1SectionBreak')
    }
  }, [h1SectionBreakSetting])

  useEffect(() => {
    if (indentSetting) {
      document.body.classList.add('indentHeading')
    } else {
      document.body.classList.remove('indentHeading')
    }
  }, [indentSetting])

  const toggleIndentSetting = () => {
    setIndentSetting(!indentSetting)
  }

  const toggleH1SectionBreakSetting = () => {
    setH1SectionBreakSetting(!h1SectionBreakSetting)
  }

  const toggleSettingModal = (e) => {
    hideAllModals()

    document.querySelector('.gearModal').classList.toggle('active')
  }
  const toggleFilterModal = (e) => {
    hideAllModals()
    const headings = document.querySelectorAll('.title')
    // console.log(search, headings)
    setTotalHeading(headings.length)
    document.querySelector('.filterModal').classList.toggle('active')
    filterSearchRef.current.focus()
  }

  const hideAllModals = () => {
    document.querySelector('.gearModal').classList.remove('active')
    document.querySelector('.filterModal').classList.remove('active')
  }

  const hideModals = (e) => {
    if (e.target.closest('.btn_modal') || e.target.closest('.nd_modal')) return
    document.querySelector('.gearModal').classList.remove('active')
    document.querySelector('.filterModal').classList.remove('active')
  }

  const searchThroughHeading = (e) => {
    const search = e.target.value
    const headings = document.querySelectorAll('.title')
    // console.log(search, headings)
    setTotalHeading(headings.length)

    const filteredHeadings = Array.from(headings).filter((heading) => {
      const key = search

      const regex = new RegExp(key, 'i')
      if (regex.test(heading.textContent)) {
        return { node: heading, text: heading.textContent }
      }
    })

    setTotalSearch(filteredHeadings.length)

    if (e.key === 'Enter') {
      // TODO: fix this hack
      // router.push(`/${router.query.slugs.at(0)}/${search}`, undefined, {
      //   shallow: false,
      // })
      const mainDoc = router.query.slugs.at(0)
      window.location.href = `/${mainDoc}/${encodeURIComponent(search)}`
    }
  }

  const applySerchThroughHeading = () => {
    const search = filterSearchRef.current.value
    const mainDoc = router.query.slugs.at(0)
    window.location.href = `/${mainDoc}/${encodeURIComponent(search)}`
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

      <button
        className={editor.isActive('link') ? 'is-active' : ''}
        onClick={setLink}>
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

      <button
        className="btn_settingModal btn_modal"
        onClick={toggleSettingModal}>
        <Gear fill="rgba(0,0,0,.7)" size="16" />
      </button>

      <GearModal>
        <p className="font-medium text-base text-gray-400 pb-1">Settings:</p>
        <hr />
        <div className="content pt-5 ">
          <label
            className="inline-flex relative items-center cursor-pointer"
            htmlFor="headingIndent-toggle">
            <input
              checked={indentSetting}
              className="sr-only peer"
              id="headingIndent-toggle"
              type="checkbox"
              value=""
              onChange={(e) => toggleIndentSetting(e.target)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
              {' '}
              Toggle heading indent
            </span>
          </label>
        </div>
        <div className="content pt-5 ">
          <label
            className="inline-flex relative items-center cursor-pointer"
            htmlFor="h1sectionbreak-toggle">
            <input
              checked={h1SectionBreakSetting}
              className="sr-only peer"
              id="h1sectionbreak-toggle"
              type="checkbox"
              value=""
              onChange={(e) => toggleH1SectionBreakSetting(e.target)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
              {' '}
              Toggle H1 section break
            </span>
          </label>
        </div>
      </GearModal>
      <FilterModal>
        <p className="font-medium text-base text-gray-400 pb-1">Filter:</p>
        <hr />
        <div className="content pt-2 flex align-middle justify-between">
          <input
            // checked={searchSetting}
            id="filterSearchBox"
            className="p-1 px-2 rounded bg-slate-200 text-black"
            type="text"
            placeholder="Find"
            onKeyDown={searchThroughHeading}
            ref={filterSearchRef}
          />
          <p className="ml-2 text-sm">
            {totalSearch} of {totalHeading}
          </p>
          <button
            onClick={applySerchThroughHeading}
            className="!p-3 !w-16  border">
            Apply
          </button>
        </div>
      </FilterModal>
    </div>
  )
}

export default Toolbar
