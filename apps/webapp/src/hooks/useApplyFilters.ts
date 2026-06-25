import { useStore } from '@stores'
import { normalizeSlugQuery } from '@utils/filterRoute'
import { useRouter } from 'next/router'
import { useEffect, useMemo } from 'react'

const useApplyFilters = () => {
  const router = useRouter()
  const slugSegments = useMemo(
    () => normalizeSlugQuery(router.query.slugs as string | string[] | undefined),
    [router.query.slugs]
  )
  const mode: 'or' | 'and' = router.query.mode === 'and' ? 'and' : 'or'
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!router.isReady || !editor || loading || providerSyncing) return

    const filterSlugs =
      slugSegments.length > 1
        ? slugSegments.slice(1).map((segment) => decodeURIComponent(segment).toLowerCase())
        : []

    if (filterSlugs.length === 0) {
      editor.commands.clearFilter()
      setWorkspaceEditorSetting('filterResult', { sortedSlugs: [] })
      return
    }

    editor.commands.applyFilter(filterSlugs, mode)
    setWorkspaceEditorSetting('filterResult', {
      sortedSlugs: filterSlugs.map((text) => ({
        type: 'parent' as const,
        text,
        existsInParent: true
      }))
    })
  }, [
    router.isReady,
    loading,
    providerSyncing,
    slugSegments,
    mode,
    editor,
    setWorkspaceEditorSetting
  ])
}

export default useApplyFilters
