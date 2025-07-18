import { EditorContent } from '@tiptap/react'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useEffect } from 'react'

export const Input = () => {
  const { editorRef, editor, messageDraftMemory } = useMessageComposer()

  useEffect(() => {
    console.log('we are setting the content ======>>>>', messageDraftMemory)
    if (messageDraftMemory) {
      editor?.commands.setContent(messageDraftMemory.html)
    }
  }, [messageDraftMemory, editor])
  return (
    <div className="flex-1 px-1 py-2 text-base sm:px-2">
      <EditorContent
        ref={editorRef}
        className="max-h-52 w-full overflow-auto"
        editor={editor}
        dir="auto"
      />
    </div>
  )
}

Input.displayName = 'Input'
