import { EditorContent } from '@tiptap/react'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

export const Input = ({ className }: { className?: string }) => {
  const { editorRef, editor, messageDraftMemory, isEmojiOnly } = useMessageComposer()

  useEffect(() => {
    if (messageDraftMemory) {
      editor?.commands.setContent(messageDraftMemory.html)
    }
  }, [messageDraftMemory, editor])

  return (
    <div className={twMerge('flex-1 px-1 py-2 text-base sm:px-2', className)} tabIndex={1}>
      <EditorContent
        id="chatroom-editor"
        tabIndex={2}
        ref={editorRef}
        className={twMerge(
          'max-h-52 w-full overflow-auto wrap-anywhere break-all whitespace-pre-line transition-all duration-200 ease-in-out',
          isEmojiOnly ? 'text-xl sm:text-2xl' : 'text-base'
        )}
        editor={editor}
        dir="auto"
      />
    </div>
  )
}

Input.displayName = 'Input'
