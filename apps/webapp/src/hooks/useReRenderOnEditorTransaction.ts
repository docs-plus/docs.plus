import type { Editor } from '@tiptap/react'
import { useEffect, useReducer, useRef } from 'react'

const THROTTLE_MS = 50

/**
 * Local React state (toolbar `isActive`) stays in sync without
 * `shouldRerenderOnTransaction` on the whole `useEditor` tree.
 * rAF after a short throttle so the re-render never fights the next keystroke.
 */
function useReRenderOnEditorTransaction(editor: Editor | null | undefined): void {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return

    const run = () => {
      if (timerRef.current !== null) return
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          rerender()
        })
      }, THROTTLE_MS)
    }
    editor.on('transaction', run)
    return () => {
      editor.off('transaction', run)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [editor])
}

export default useReRenderOnEditorTransaction
