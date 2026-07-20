import { computeSection } from '@components/TipTap/extensions/shared'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { copyToClipboard } from '@utils/clipboard'
import { buildHeadingHref } from '@utils/link-helpers'
import Router from 'next/router'
import PubSub from 'pubsub-js'

import {
  navigateToDocTitle as navigateToDocTitleAction,
  navigateToHeading as navigateToHeadingAction
} from '../utils/navigateToHeading'

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

function editorOrNull() {
  return useStore.getState().settings.editor.instance
}

/** Call-time getState / Router — one stable object, no per-row subscriptions. */
export const tocActions = {
  openChatroom(headingId: string, options?: { scrollTo?: boolean; focusEditor?: boolean }): void {
    PubSub.publish(CHAT_OPEN, {
      headingId,
      scrollTo: options?.scrollTo ?? false,
      ...(options?.focusEditor !== undefined && { focusEditor: options.focusEditor })
    })
  },

  /** Outline-row navigate — URL ± optional CHAT_OPEN. Never sets focusEditor. */
  navigateToHeading(
    headingId: string,
    options?: { openChat?: boolean; updateUrl?: boolean }
  ): void {
    const editor = editorOrNull()
    if (!editor) return
    navigateToHeadingAction(editor, headingId, options)
  },

  /** Doc-title header navigate — URL ± optional CHAT_OPEN for the workspace channel. */
  navigateToDocTitle(options: { openChat?: boolean }): void {
    const { workspaceId, metadata } = useStore.getState().settings
    navigateToDocTitleAction({
      workspaceId,
      title: metadata?.title ?? '',
      openChat: options.openChat
    })
  },

  async copyLink(headingId: string): Promise<void> {
    const editor = editorOrNull()
    if (!headingId || !editor) return

    const href = buildHeadingHref(editor, headingId)
    const success = await copyToClipboard(href)
    if (success) {
      toast.Success('Section link copied to clipboard')
    } else {
      toast.Error('Failed to copy link')
    }
  },

  focusSection(headingId: string): void {
    const editor = editorOrNull()
    if (!headingId || !editor) return

    const headingElement = document.querySelector(
      `:is(h1,h2,h3,h4,h5,h6)[data-toc-id="${headingId}"]`
    ) as HTMLElement | null
    if (!headingElement) return

    const headingText = (headingElement.innerText || headingElement.textContent || '').trim()
    if (!headingText) return

    const url = new URL(window.location.href)
    url.searchParams.forEach((_, key) => {
      url.searchParams.delete(key)
    })

    const slugs = url.pathname.split('/').slice(1)
    url.pathname = `/${slugs.at(0)}/${encodeURIComponent(headingText)}`
    url.searchParams.set('id', headingId)

    void Router.push(url.toString(), undefined, { shallow: true })
  },

  deleteSection(headingId: string): void {
    if (!headingId) return
    useStore.getState().openDialog(<DeleteSectionDialog headingId={headingId} />)
  }
}
