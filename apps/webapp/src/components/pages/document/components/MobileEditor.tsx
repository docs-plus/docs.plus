import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import { useHeadingScrollSpy } from '@components/toc/hooks/useHeadingScrollSpy'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { useRef } from 'react'

import { useAdjustEditorSizeForChatRoom } from '../hooks'
import EditorContent from './EditorContent'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEditableDocControl()

  // IntersectionObserver-based scroll spy for TOC highlighting (mirrors DesktopEditor)
  useHeadingScrollSpy(editorWrapperRef)

  // ProseMirror `.ha-chat-btn` widgets (CSS ::before); TOC uses React UnreadBadge.
  useUnreadSync()

  return (
    <div
      ref={editorWrapperRef}
      className="editor editorWrapper scrollbar-custom scrollbar-thin relative flex min-h-0 w-full max-w-full flex-1 flex-col justify-start overflow-y-auto scroll-smooth">
      <EditorContent />
    </div>
  )
}

export default Editor
