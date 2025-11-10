import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { useStore } from '@stores'

const useFocusHeadingSectionHandler = (tocId: string) => {
  const router = useRouter()
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const {
    editor: { applyingFilters }
  } = useStore((state) => state.settings)
  const focusHeadingSectionHandler = useCallback(() => {
    if (!tocId) return

    const headingElement = document.querySelector(
      `.heading[data-id="${tocId}"] .title`
    ) as HTMLElement
    if (!headingElement) return

    const headingText = (headingElement?.innerText || headingElement?.textContent || '').trim()
    if (!headingText) return

    setWorkspaceEditorSetting('applyingFilters', false)

    const url = new URL(window.location.href)
    // remove all query params
    url.searchParams.forEach((value, key) => {
      url.searchParams.delete(key)
    })

    const slugs = url.pathname.split('/').slice(1)

    // reset all filter and use the base document slug
    url.pathname = `/${slugs.at(0)}/${encodeURIComponent(headingText)}`
    url.searchParams.set('id', tocId)

    router.push(url.toString(), undefined, { shallow: true })
    setWorkspaceEditorSetting('applyingFilters', true)
  }, [tocId, router])

  return focusHeadingSectionHandler
}

export default useFocusHeadingSectionHandler
