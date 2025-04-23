import { useRef } from 'react'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import EditorContent from './EditorContent'
import ToolbarMobile from './toolbarMobile/ToolbarMobile'
import { useChatStore } from '@stores'
import { scrollHeadingSelection } from '../helpers'
import { useAdjustEditorSizeForChatRoom } from '../hooks'
import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import usePageHeightAdjust from '@components/pages/document/hooks/usePageHeightAdjust'
import useUpdateDocPageUnreadMsg from '@components/pages/document/hooks/useUpdateDocPageUnreadMsg'
import { MobileBubbleMenu } from './MobileBubbleMenu'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const chatRoom = useChatStore((state) => state.chatRoom)

  const isKeyboardOpen = useDetectKeyboardOpen() || false

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEditableDocControl()

  usePageHeightAdjust()

  useUpdateDocPageUnreadMsg()

  return (
    <>
      <div className="editor relative flex size-full w-full max-w-full flex-col justify-around align-top">
        <div
          ref={editorWrapperRef}
          className="editorWrapper flex h-full grow items-start justify-center overflow-hidden overflow-y-auto p-0"
          onScroll={scrollHeadingSelection}>
          <MobileBubbleMenu />
          <EditorContent />
        </div>
      </div>

      <div
        className={`toolbars bg-base-100 sticky inset-x-0 bottom-0 z-10 w-full ${
          isKeyboardOpen && !chatRoom?.headingId ? 'block' : 'hidden'
        }`}>
        <ToolbarMobile />
      </div>
    </>
  )
}

export default Editor
