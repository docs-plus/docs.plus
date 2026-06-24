import { EditorContent } from '@tiptap/react'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'

export const Input = ({ className }: { className?: string }) => {
  const { editorRef, editor, isEmojiOnly } = useMessageComposer()

  return (
    <div
      className={twMerge('text-base-content flex min-h-8 min-w-0 flex-1 items-center', className)}
      tabIndex={1}>
      <EditorContent
        id="chatroom-editor"
        data-testid="composer-input"
        tabIndex={2}
        ref={editorRef}
        className={twMerge(
          'text-base-content max-h-52 w-full overflow-y-auto break-words wrap-anywhere whitespace-pre-line',
          isEmojiOnly ? 'text-xl leading-8 sm:text-2xl' : 'text-base leading-8'
        )}
        editor={editor}
        dir="auto"
      />
    </div>
  )
}

Input.displayName = 'Input'
