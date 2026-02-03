import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import { type ResolvedPos, TIPTAP_NODES } from '@types'
import { copyToClipboard } from '@utils/clipboard'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'
import slugify from 'slugify'

/**
 * Dialog content for delete confirmation
 */
function DeleteSectionDialog({ headingId }: { headingId: string }) {
  const {
    closeDialog,
    settings: {
      editor: { instance: editor }
    }
  } = useStore()

  const handleDelete = () => {
    closeDialog()

    const headingElement = document.querySelector(`.heading[data-id="${headingId}"]`)
    if (!headingElement) return

    const contentHeadingPos = editor?.view.posAtDOM(headingElement, -4, 4)
    const contentHeadingNode = editor?.state.doc.nodeAt(contentHeadingPos as number)

    if ((contentHeadingPos && contentHeadingPos === -1) || !contentHeadingNode) return

    const $pos = editor?.state.doc.resolve(contentHeadingPos as number) as ResolvedPos
    let parentHeadingPos: number | null = null
    let parentHeadingNode = null

    for (let depth = $pos.depth; depth > 0; depth--) {
      const node = $pos.node(depth)
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
        parentHeadingPos = $pos.start(depth)
        parentHeadingNode = node
        break
      }
    }

    if (parentHeadingPos !== null && parentHeadingNode) {
      const tr = editor?.state.tr
      const startPos = parentHeadingPos - 4
      const endPos = parentHeadingPos + parentHeadingNode.nodeSize

      tr?.delete(startPos, endPos)
      if (tr) {
        editor?.view.dispatch(tr)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 pr-3 pb-3">
      <p className="text-base-content/70">Do you want to delete this heading section?</p>
      <div className="flex justify-end gap-4">
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant="error" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  )
}

/**
 * Hook that provides all TOC actions
 */
export function useTocActions() {
  const router = useRouter()
  const { openDialog } = useStore()
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const openChatroom = useCallback(
    (headingId: string, options?: { scrollTo?: boolean; focusEditor?: boolean }) => {
      if (!editor) return

      PubSub.publish(CHAT_OPEN, {
        headingId,
        scrollTo: options?.scrollTo ?? false,
        ...(options?.focusEditor !== undefined && { focusEditor: options.focusEditor })
      })
    },
    [editor]
  )

  const copyLink = useCallback(
    async (headingId: string) => {
      if (!headingId || !editor) return

      const targetHeading = document.querySelector(`.heading[data-id="${headingId}"]`)
      if (!targetHeading) return

      const posAt = editor.view.posAtDOM(targetHeading, 0)
      if (posAt === -1) return

      const nodePos = editor.view.state.doc.resolve(posAt)
      // @ts-ignore - path exists on ResolvedPos
      const headingPath = nodePos.path
        .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
        .map((x: any) => slugify(x.firstChild?.textContent?.toLowerCase()?.trim() || ''))

      const url = new URL(window.location.href)
      url.searchParams.set('h', headingPath.join('>'))
      url.searchParams.set('id', headingId)

      const success = await copyToClipboard(url.toString())
      if (success) {
        toast.Success('Section link copied to clipboard')
      } else {
        toast.Error('Failed to copy link')
      }
    },
    [editor]
  )

  const focusSection = useCallback(
    (headingId: string) => {
      if (!headingId) return

      const headingElement = document.querySelector(
        `.heading[data-id="${headingId}"] .title`
      ) as HTMLElement
      if (!headingElement) return

      const headingText = (headingElement.innerText || headingElement.textContent || '').trim()
      if (!headingText) return

      setWorkspaceEditorSetting('applyingFilters', false)

      const url = new URL(window.location.href)
      url.searchParams.forEach((_, key) => {
        url.searchParams.delete(key)
      })

      const slugs = url.pathname.split('/').slice(1)
      url.pathname = `/${slugs.at(0)}/${encodeURIComponent(headingText)}`
      url.searchParams.set('id', headingId)

      router.push(url.toString(), undefined, { shallow: true })
      setWorkspaceEditorSetting('applyingFilters', true)
    },
    [router, setWorkspaceEditorSetting]
  )

  const deleteSection = useCallback(
    (headingId: string) => {
      if (!headingId) return
      openDialog(<DeleteSectionDialog headingId={headingId} />)
    },
    [openDialog]
  )

  return {
    openChatroom,
    copyLink,
    focusSection,
    deleteSection
  }
}
