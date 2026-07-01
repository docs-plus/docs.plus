import { EditorContent } from '@tiptap/react'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'

export const Input = ({ className }: { className?: string }) => {
  const { editorRef, editor, isEmojiOnly, isMobile } = useMessageComposer()

  const rowHeight = isMobile ? 'min-h-11' : 'min-h-8'

  let textLeading: string
  if (isMobile) {
    textLeading = isEmojiOnly ? 'text-xl leading-[2.75rem]' : 'text-base leading-[2.75rem]'
  } else if (isEmojiOnly) {
    textLeading = 'text-xl leading-8 sm:text-2xl'
  } else {
    textLeading = 'text-base leading-8'
  }

  return (
    <div
      className={twMerge(
        'text-base-content flex min-w-0 flex-1 items-center self-center',
        rowHeight,
        className
      )}
      tabIndex={1}>
      <EditorContent
        id="chatroom-editor"
        data-testid="composer-input"
        tabIndex={2}
        ref={editorRef}
        className={twMerge(
          'text-base-content max-h-52 w-full overflow-y-auto break-words wrap-anywhere whitespace-pre-line',
          rowHeight,
          textLeading
        )}
        editor={editor}
        dir="auto"
      />
    </div>
  )
}

Input.displayName = 'Input'
