import { computeSection } from '@components/TipTap/extensions/shared'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { copyToClipboard } from '@utils/clipboard'
import { buildHeadingHref } from '@utils/link-helpers'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'

function DeleteSectionDialog({ headingId }: { headingId: string }) {
  const closeDialog = useStore((state) => state.closeDialog)
  const editor = useStore((state) => state.settings.editor.instance)

  const handleDelete = () => {
    closeDialog()
    if (!editor) return

    const doc = editor.state.doc
    let offset = 0

    for (let i = 0; i < doc.content.childCount; i++) {
      const child = doc.content.child(i)
      const pos = offset
      offset += child.nodeSize

      if (
        child.type.name === TIPTAP_NODES.HEADING_TYPE &&
        (child.attrs['toc-id'] as string) === headingId
      ) {
        const section = computeSection(doc, pos, child.attrs.level as number, i)
        const tr = editor.state.tr
        tr.delete(section.from, section.to)
        editor.view.dispatch(tr)
        return
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

export function useTocActions() {
  const router = useRouter()
  const openDialog = useStore((state) => state.openDialog)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const editor = useStore((state) => state.settings.editor.instance)

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

      const href = buildHeadingHref(editor, headingId)
      const success = await copyToClipboard(href)
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
      if (!headingId || !editor) return

      const headingElement = document.querySelector(`[data-toc-id="${headingId}"]`) as HTMLElement
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
    [editor, router, setWorkspaceEditorSetting]
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
