import type { Editor } from '@tiptap/react'
import { useEffect, useReducer } from 'react'

/**
 * Subscribes to the TipTap editor transaction lifecycle so local React state
 * (e.g. toolbar `isActive`) stays in sync without forcing `shouldRerenderOnTransaction`
 * on the whole `useEditor` tree (document layout + sidebars).
 */
function useReRenderOnEditorTransaction(editor: Editor | null | undefined): void {
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!editor) return

    const run = () => rerender()
    editor.on('transaction', run)
    return () => {
      editor.off('transaction', run)
    }
  }, [editor])
}

export default useReRenderOnEditorTransaction
