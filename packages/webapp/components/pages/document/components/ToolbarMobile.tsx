import React from 'react'
import {
  OrderListMobile,
  BoldMobile,
  ItalicMobile,
  UnderlineMobile,
  InsertLinkMobile
} from '@icons'
import { useStore } from '@stores'

const ToolbarMobile = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  if (!editor) {
    return null
  }

  const buttons = [
    { name: 'bold', icon: BoldMobile, action: 'toggleBold', size: 24 },
    { name: 'italic', icon: ItalicMobile, action: 'toggleItalic', size: 24 },
    { name: 'underline', icon: UnderlineMobile, action: 'toggleUnderline', size: 24 },
    { name: 'orderedList', icon: OrderListMobile, action: 'toggleOrderedList', size: 26 },
    { name: 'link', icon: InsertLinkMobile, action: 'setHyperlink', size: 26 }
  ]

  const handleButtonClick = (e: any, action: string) => {
    e.preventDefault()
    editor.view.focus()
    // @ts-ignore
    editor.chain().focus()[action]().run()
  }

  return (
    <div className="tiptap__toolbar flex h-12 items-center justify-around gap-1 bg-base-100 text-blue-700">
      {buttons.map(({ name, icon: Icon, action, size }) => (
        <button
          key={name}
          className={`mx-1 flex h-full flex-1 items-center justify-center p-0 ${editor.isActive(name) ? 'is-active' : ''}`}
          onClick={(e) => handleButtonClick(e, action)}>
          <Icon size={size} className={editor.isActive(name) ? 'fill-current text-blue-700' : ''} />
        </button>
      ))}
    </div>
  )
}

export default ToolbarMobile
