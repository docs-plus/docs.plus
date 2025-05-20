import { useRef } from 'react'
import ToolbarDesktop from '@components/TipTap/toolbar/ToolbarDesktop'
import EditorContent from './EditorContent'
import TOC from './Toc'
import { useStore } from '@stores'
import ChatContainer from './chat/ChatContainer'
import { scrollHeadingSelection } from '../helpers'
import { useAdjustEditorSizeForChatRoom, useTOCResize } from '../hooks'
import useUpdateDocPageUnreadMsg from '../hooks/useUpdateDocPageUnreadMsg'

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const {
    editor: { isMobile }
  } = useStore((state) => state.settings)

  // Hook for TOC resize functionality
  const { tocRef, tocWidth, handleMouseDown, editorContainerStyle } = useTOCResize()

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useUpdateDocPageUnreadMsg()

  return (
    <>
      <div className="toolbars fixed bottom-0 z-[9] h-auto w-full bg-white sm:relative sm:block">
        <ToolbarDesktop />
      </div>
      <div className="editor relative flex size-full flex-row-reverse justify-around align-top">
        <div className="relative flex flex-col align-top" style={editorContainerStyle}>
          <div
            ref={editorWrapperRef}
            className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4"
            onScroll={!isMobile ? scrollHeadingSelection : undefined}>
            <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
          </div>
          <ChatContainer />
        </div>
        <div
          ref={tocRef}
          className="tableOfContents relative h-full max-h-full"
          style={{
            width: tocWidth
          }}>
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 z-10 h-full w-[1px] cursor-col-resize bg-gray-300 select-none"
          />
          <TOC />
        </div>
      </div>
    </>
  )
}

export default DesktopEditor
