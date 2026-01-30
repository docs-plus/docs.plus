import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { useRef } from 'react'

import { useAdjustEditorSizeForChatRoom } from '../hooks'
import EditorContent from './EditorContent'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEditableDocControl()

  // Sync unread counts to all badges via UNREAD_SYNC event (CSS handles visuals)
  useUnreadSync()

  return (
    <div
      ref={editorWrapperRef}
      className="editor editorWrapper relative flex min-h-0 w-full max-w-full flex-1 flex-col justify-start overflow-y-auto p-0">
      <EditorContent />
    </div>
  )
}

export default Editor
