import { padUrl } from '@services/padUrl'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { arriveAtHeading } from '@utils/arriveAtHeading'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

/**
 * A cold `?id=` lands after sync. Call it after `useApplyFilters`, so a Filter folds first.
 * No route deps: a TOC click writes `?id=`, and a later Filter change must not land there.
 */
const useArriveAtUrlHeading = () => {
  const { isReady } = useRouter()
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const handledRef = useRef<{ editor: Editor; headingId: string } | null>(null)

  useEffect(() => {
    if (!isReady || !editor || loading || providerSyncing) return
    const headingId = padUrl.read()?.headingId
    if (!headingId) return
    const handled = handledRef.current
    if (handled?.editor === editor && handled.headingId === headingId) return

    const arrive = () => {
      handledRef.current = { editor, headingId }
      arriveAtHeading(headingId)
    }
    // Sync can finish before EditorContent mounts the view, and an unmounted editor holds
    // an empty doc. Tiptap emits `create` once the view shows the synced content.
    if (editor.isInitialized) return arrive()
    editor.on('create', arrive)
    return () => {
      editor.off('create', arrive)
    }
  }, [isReady, editor, loading, providerSyncing])
}

export default useArriveAtUrlHeading
