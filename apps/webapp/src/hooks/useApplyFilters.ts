import { padUrl } from '@services/padUrl'
import { useStore } from '@stores'
import { useRouter } from 'next/router'
import { useEffect, useMemo } from 'react'

const useApplyFilters = () => {
  const router = useRouter()
  // Raw segments, decoded once: `router.query.slugs` is already decoded.
  // Keyed on a string, so a query-only change does not re-run the filter.
  const pad = padUrl.read(router.asPath)
  const termKey = JSON.stringify((pad?.terms ?? []).map((term) => term.toLowerCase()))
  const filterSlugs = useMemo(() => JSON.parse(termKey) as string[], [termKey])
  const mode = pad?.mode ?? 'or'
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!router.isReady || !editor || loading || providerSyncing) return

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
    filterSlugs,
    mode,
    editor,
    setWorkspaceEditorSetting
  ])
}

export default useApplyFilters
