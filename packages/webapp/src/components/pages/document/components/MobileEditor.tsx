import { useRef } from 'react'
import EditorContent from './EditorContent'
import { useChatStore, useStore, useSheetStore } from '@stores'
import { useAdjustEditorSizeForChatRoom } from '../hooks'
import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import useUpdateDocPageUnreadMsg from '@components/pages/document/hooks/useUpdateDocPageUnreadMsg'
import { MobileBubbleMenu } from './MobileBubbleMenu'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const chatRoom = useChatStore((state) => state.chatRoom)
  const { activeSheet, pendingSheet } = useSheetStore((state) => state)

  const { isKeyboardOpen, virtualKeyboardState } = useStore((state) => state)

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEditableDocControl()

  useUpdateDocPageUnreadMsg()

  // Prevent native context menu on mobile - use custom bubble menu instead
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    return false
  }

  return (
    <>
      <div
        ref={editorWrapperRef}
        onContextMenu={handleContextMenu}
        className="editor editorWrapper relative flex size-full w-full max-w-full flex-col justify-center overflow-y-auto p-0">
        <MobileBubbleMenu />
        <EditorContent />
      </div>

      <div
        className={`toolbars bg-base-100 z-10 w-full transition-all duration-300 ease-in-out ${
          virtualKeyboardState === 'closing'
            ? 'pointer-events-none translate-y-4 opacity-0'
            : isKeyboardOpen && !chatRoom?.headingId && !activeSheet && !pendingSheet
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-4 opacity-0'
        }`}></div>
    </>
  )
}

export default Editor
