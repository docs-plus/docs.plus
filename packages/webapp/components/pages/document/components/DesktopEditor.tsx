import { useRef } from 'react'
import clsx from 'clsx'
import ToolbarDesktop from '@components/TipTap/toolbar/ToolbarDesktop'
import EditorContent from './EditorContent'
import TOC from './Toc'
import { useStore, useChatStore } from '@stores'
import ChatContainer from './chat/ChatContainer'
import { scrollHeadingSelection } from '../helpers'
import { useAdjustEditorSizeForChatRoom } from '../hooks'

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const {
    editor: { isMobile }
  } = useStore((state) => state.settings)

  const chatRoom = useChatStore((state) => state.chatRoom)

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  const editorWrapperClassNames = clsx(
    'editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4'
  )

  const tableOfContentsClassNames = clsx(
    chatRoom.headingId ? 'border-r border-gray-300' : '',
    'tableOfContents h-full max-h-full w-[22%]'
  )

  return (
    <>
      <div className="toolbars fixed bottom-0 z-[9] h-auto w-full bg-white sm:relative sm:block">
        <ToolbarDesktop />
      </div>
      <div className="editor relative flex size-full flex-row-reverse justify-around align-top">
        <div className="relative flex w-[78%] max-w-full flex-col align-top">
          <div
            ref={editorWrapperRef}
            className={editorWrapperClassNames}
            onScroll={!isMobile ? scrollHeadingSelection : undefined}>
            <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
          </div>
          <ChatContainer />
        </div>
        <div className={tableOfContentsClassNames}>
          <TOC />
        </div>
      </div>
    </>
  )
}

export default DesktopEditor
