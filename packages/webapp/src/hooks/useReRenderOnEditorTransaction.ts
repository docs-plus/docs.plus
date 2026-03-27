import type { Editor } from '@tiptap/react'
import { useEffect, useReducer, useRef } from 'react'

const THROTTLE_MS = 50

/**
 * Subscribes to the TipTap editor transaction lifecycle so local React state
 * (e.g. toolbar `isActive`) stays in sync without forcing `shouldRerenderOnTransaction`
 * on the whole `useEditor` tree (document layout + sidebars).
 *
 * Throttled with rAF: batches rapid keystrokes into a single React re-render
 * per throttle window, then yields to the browser via requestAnimationFrame
 * so the re-render never competes with the next keystroke's input event.
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
