import { useEffect, useRef, useState } from 'react'
import EditorContent from './EditorContent'
import ToolbarMobile from './toolbarMobile/ToolbarMobile'
import { useChatStore, useStore, useSheetStore } from '@stores'
import { useAdjustEditorSizeForChatRoom } from '../hooks'
import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import usePageHeightAdjust from '@components/pages/document/hooks/usePageHeightAdjust'
import useUpdateDocPageUnreadMsg from '@components/pages/document/hooks/useUpdateDocPageUnreadMsg'
import { MobileBubbleMenu } from './MobileBubbleMenu'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const chatRoom = useChatStore((state) => state.chatRoom)
  const { activeSheet, pendingSheet } = useSheetStore((state) => state)

  const { isKeyboardOpen, virtualKeyboardState } = useStore((state) => state)

  useEffect(() => {
    console.log({
      virtualKeyboardState,
      isKeyboardOpen
    })
  }, [virtualKeyboardState, isKeyboardOpen])

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
        className={`toolbars bg-base-100 z-10 w-full transition-all duration-300 ease-in-out ${
          virtualKeyboardState === 'closing'
            ? 'pointer-events-none translate-y-4 opacity-0'
            : isKeyboardOpen && !chatRoom?.headingId && !activeSheet && !pendingSheet
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-4 opacity-0'
        }`}>
        <ToolbarMobile />
      </div>
    </>
  )
}

export default Editor
