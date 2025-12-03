import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { useStore } from '@stores'
import { ResolvedPos } from '@tiptap/pm/model'
import slugify from 'slugify'
import PubSub from 'pubsub-js'
import { TIPTAP_NODES, TIPTAP_EVENTS } from '@types'
import { copyToClipboard } from '@utils/index'
import * as toast from '@components/toast'

/**
 * Hook providing heading section actions: toggle fold, focus, copy link, delete.
 */
const useHeadingActions = () => {
  const router = useRouter()
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)
  const { closeDialog } = useStore()
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  /**
   * Toggle fold/unfold of a TOC section
   */
  const toggleFold = useCallback((headingId: string) => {
    const itemElement = document.querySelector(`.toc__item[data-id="${headingId}"]`) as HTMLElement
    if (!itemElement) return

    const btnFoldElement = itemElement.querySelector('.btnFold') as HTMLElement
    const childrenWrapper = itemElement.querySelector('.childrenWrapper')
    const isOpen = !itemElement.classList.contains('closed')

    itemElement.classList.toggle('closed')
    btnFoldElement?.classList.toggle('closed')
    btnFoldElement?.classList.toggle('opened')
    childrenWrapper?.classList.toggle('hidden')

    PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, { headingId, open: !isOpen })
  }, [])

  /**
   * Focus on a specific section (filter URL)
   */
  const focusSection = useCallback(
    (headingId: string) => {
      const headingElement = document.querySelector(
        `.heading[data-id="${headingId}"] .title`
      ) as HTMLElement
      if (!headingElement) return

      const headingText = (headingElement?.innerText || headingElement?.textContent || '').trim()
      if (!headingText) return

      setWorkspaceEditorSetting('applyingFilters', false)

      const url = new URL(window.location.href)
      url.searchParams.forEach((_, key) => url.searchParams.delete(key))

      const slugs = url.pathname.split('/').slice(1)
      url.pathname = `/${slugs.at(0)}/${encodeURIComponent(headingText)}`
      url.searchParams.set('id', headingId)

      router.push(url.toString(), undefined, { shallow: true })
      setWorkspaceEditorSetting('applyingFilters', true)
    },
    [router, setWorkspaceEditorSetting]
  )

  /**
   * Copy deep link to heading
   */
  const copyLink = useCallback(
    (headingId: string) => {
      if (!editor) return

      const targetHeading = document.querySelector(`.heading[data-id="${headingId}"]`)
      if (!targetHeading) return

      const posAt = editor.view.posAtDOM(targetHeading, 0)
      if (posAt === -1) return

      const nodePos = editor.state.doc.resolve(posAt)
      // @ts-ignore
      const headingPath = nodePos.path
        .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
        .map((x: any) => slugify(x.firstChild?.textContent?.toLowerCase().trim() || ''))

      const url = new URL(window.location.href)
      url.searchParams.set('h', headingPath.join('>'))
      url.searchParams.set('id', headingId)

      copyToClipboard(url.toString())
      toast.Success('URL copied to clipboard')
    },
    [editor]
  )

  /**
   * Delete heading section with all nested content
   */
  const deleteSection = useCallback(
    (headingId: string, onConfirm?: () => void) => {
      if (!editor) return

      const handleDelete = () => {
        closeDialog()

        const headingNodeElement = document.querySelector(`.heading[data-id="${headingId}"]`)
        if (!headingNodeElement) return

        const contentHeadingNodePos = editor.view.posAtDOM(headingNodeElement, -4, 4)
        const contentHeadingNode = editor.state.doc.nodeAt(contentHeadingNodePos)

        if (contentHeadingNodePos === -1 || !contentHeadingNode) return

        const $pos = editor.state.doc.resolve(contentHeadingNodePos) as ResolvedPos
        let parentHeadingPos: number | null = null
        let parentHeadingNode = null

        for (let depth = $pos.depth; depth > 0; depth--) {
          const node = $pos.node(depth)
          if (node.type.name === 'heading') {
            parentHeadingPos = $pos.start(depth)
            parentHeadingNode = node
            break
          }
        }

        if (parentHeadingPos !== null && parentHeadingNode) {
          const tr = editor.state.tr
          const startPos = parentHeadingPos - 4
          const endPos = parentHeadingPos + parentHeadingNode.nodeSize

          tr.delete(startPos, endPos)
          editor.view.dispatch(tr)
        }

        onConfirm?.()
      }

      return handleDelete
    },
    [editor, closeDialog]
  )

  return {
    toggleFold,
    focusSection,
    copyLink,
    deleteSection
  }
}

export default useHeadingActions
