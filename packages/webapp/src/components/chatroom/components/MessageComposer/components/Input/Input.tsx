import { EditorContent } from '@tiptap/react'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'

export const Input = ({ className }: { className?: string }) => {
  const { editorRef, editor, isEmojiOnly } = useMessageComposer()

  return (
    <div
      className={twMerge('text-base-content flex-1 px-1 py-2 text-base sm:px-2', className)}
      tabIndex={1}>
      <EditorContent
        id="chatroom-editor"
        tabIndex={2}
        ref={editorRef}
        className={twMerge(
          'text-base-content max-h-52 w-full overflow-auto wrap-anywhere break-all whitespace-pre-line transition-all duration-200 ease-in-out',
          isEmojiOnly ? 'text-xl sm:text-2xl' : 'text-base'
        )}
        editor={editor}
        dir="auto"
      />
    </div>
  )
}

Input.displayName = 'Input'
