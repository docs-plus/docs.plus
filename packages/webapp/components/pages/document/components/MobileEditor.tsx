import { useEffect, useRef, useState } from 'react'
import EditorContent from './EditorContent'
import ToolbarMobile from './toolbarMobile/ToolbarMobile'
import { useChatStore } from '@stores'
import { useAdjustEditorSizeForChatRoom } from '../hooks'
import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import usePageHeightAdjust from '@components/pages/document/hooks/usePageHeightAdjust'
import useUpdateDocPageUnreadMsg from '@components/pages/document/hooks/useUpdateDocPageUnreadMsg'
import { MobileBubbleMenu } from './MobileBubbleMenu'
import { animate, useMotionValue } from 'motion/react'
import useKeyboardHeight from '@hooks/useKeyboardHeight'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const chatRoom = useChatStore((state) => state.chatRoom)

  const { isOpen: isKeyboardOpen, height: keyboardHeight, viewportHeight } = useKeyboardHeight()

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEditableDocControl()

  usePageHeightAdjust()

  useUpdateDocPageUnreadMsg()

  return (
    <>
      <div className="editor editorHeighttt relative flex size-full w-full max-w-full flex-col justify-around align-top">
        <div
          ref={editorWrapperRef}
          className="editorWrapper flex h-full w-full justify-center overflow-hidden overflow-y-auto p-0">
          <MobileBubbleMenu />
          <EditorContent />
        </div>
      </div>

      <div
        className={`toolbars bg-base-100 z-10 w-full ${
          isKeyboardOpen && !chatRoom?.headingId ? 'block' : 'hidden'
        }`}>
        <ToolbarMobile />
      </div>
    </>
  )
}

export default Editor
