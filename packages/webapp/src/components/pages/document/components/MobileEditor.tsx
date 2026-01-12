import { useRef } from 'react'
import EditorContent from './EditorContent'
import { useAdjustEditorSizeForChatRoom } from '../hooks'
import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import useUpdateDocPageUnreadMsg from '@components/pages/document/hooks/useUpdateDocPageUnreadMsg'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEditableDocControl()

  useUpdateDocPageUnreadMsg()

  return (
    <div
      ref={editorWrapperRef}
      className="editor editorWrapper relative flex min-h-0 w-full max-w-full flex-1 flex-col justify-start overflow-y-auto p-0">
      <EditorContent />
    </div>
  )
}

export default Editor
