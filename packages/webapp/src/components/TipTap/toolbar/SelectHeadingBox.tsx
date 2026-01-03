import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IoMdArrowDropdown } from 'react-icons/io'
import { MdCheck } from 'react-icons/md'

const MAIN_OPTIONS = [
  { value: 'p', label: 'Normal Text' },
  { value: 1, label: 'Heading 1' },
  { value: 2, label: 'Heading 2' },
  { value: 3, label: 'Heading 3' },
  { value: 4, label: 'Heading 4' },
  { value: 5, label: 'Heading 5' }
]

const MORE_OPTIONS = [
  { value: 6, label: 'Heading 6' },
  { value: 7, label: 'Heading 7' },
  { value: 8, label: 'Heading 8' },
  { value: 9, label: 'Heading 9' },
  { value: 10, label: 'Heading 10' }
]

const ALL_OPTIONS = [...MAIN_OPTIONS, ...MORE_OPTIONS]

// Font size classes for visual hierarchy
const FONT_STYLES: Record<string | number, string> = {
  p: 'text-sm',
  1: 'text-lg font-semibold',
  2: 'text-base font-semibold',
  3: 'text-base font-medium',
  4: 'text-sm font-medium',
  5: 'text-sm',
  6: 'text-xs',
  7: 'text-xs',
  8: 'text-xs',
  9: 'text-xs',
  10: 'text-xs'
}

interface SelectHeadingBoxProps {
  editor: any
}

const SelectHeadingBox = ({ editor }: SelectHeadingBoxProps) => {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [showMore, setShowMore] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.removeAttribute('open')
        setShowMore(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const currentHeading = useMemo(() => {
    const active = ALL_OPTIONS.find((opt) =>
      opt.value === 'p'
        ? !editor.isActive('contentHeading')
        : editor.isActive('contentHeading', { level: opt.value })
    )
    return active || MAIN_OPTIONS[0]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.state.selection])

  const handleSelect = useCallback(
    (value: string | number) => {
      if (value === 'p') {
        editor.chain().focus().normalText().run()
      } else {
        editor.chain().focus().wrapBlock({ level: +value }).run()
      }
      detailsRef.current?.removeAttribute('open')
      setShowMore(false)
    },
    [editor]
  )

  const isActive = (value: string | number) => currentHeading.value === value

  return (
    <div className="tooltip tooltip-bottom" data-tip="Styles (⌘+⌥+[0-9])">
      <details ref={detailsRef} className="dropdown">
        <summary className="btn btn-ghost btn-sm h-8 min-h-0 gap-1 px-2 font-normal">
          <span className="min-w-20 text-left text-sm">{currentHeading.label}</span>
          <IoMdArrowDropdown className="opacity-60" />
        </summary>

        <ul className="dropdown-content menu bg-base-100 border-base-300 z-50 mt-1 w-48 rounded-lg border p-1 shadow-xl">
          {MAIN_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${FONT_STYLES[opt.value]} ${
                  isActive(opt.value) ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                }`}>
                <span>{opt.label}</span>
                {isActive(opt.value) && <MdCheck className="text-primary" size={16} />}
              </button>
            </li>
          ))}

          {/* Divider */}
          <li className="bg-base-200 my-1 h-px" role="separator" />

          {/* More toggle */}
          <li>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowMore(!showMore)
              }}
              className="text-base-content/60 hover:bg-base-200 flex items-center justify-between rounded-md px-3 py-2 text-xs">
              <span>More headings</span>
              <IoMdArrowDropdown
                className={`transition-transform ${showMore ? 'rotate-180' : ''}`}
                size={14}
              />
            </button>
          </li>

          {/* Hidden headings */}
          {showMore &&
            MORE_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center justify-between rounded-md px-3 py-2 pl-5 ${FONT_STYLES[opt.value]} ${
                    isActive(opt.value) ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                  }`}>
                  <span>{opt.label}</span>
                  {isActive(opt.value) && <MdCheck className="text-primary" size={16} />}
                </button>
              </li>
            ))}
        </ul>
      </details>
    </div>
  )
}

export default SelectHeadingBox
