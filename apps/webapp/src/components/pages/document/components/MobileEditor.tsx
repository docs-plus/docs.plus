import useEditableDocControl from '@components/pages/document/hooks/useEditableDocControl'
import { useHeadingScrollSpy } from '@components/toc/hooks/useHeadingScrollSpy'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { useRef } from 'react'

import EditorContent from './EditorContent'
import { PAD_MAIN_ID } from './SkipToPadMain'

const Editor = () => {
  const editorWrapperRef = useRef<HTMLElement>(null)

  useEditableDocControl()

  useHeadingScrollSpy(editorWrapperRef)

  // ProseMirror `.ha-chat-btn` widgets (CSS ::before); TOC uses React UnreadBadge.
  useUnreadSync()

  return (
    <main
      ref={editorWrapperRef}
      id={PAD_MAIN_ID}
      tabIndex={-1}
      className="editor editorWrapper scrollbar-custom relative flex min-h-0 w-full max-w-full flex-1 scrollbar-thin flex-col justify-start overflow-y-auto scroll-smooth outline-none">
      <EditorContent />
    </main>
  )
}

export default Editor
