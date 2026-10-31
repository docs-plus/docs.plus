import { computeSection } from '@components/TipTap/extensions/shared'
import * as toast from '@components/toast'
import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'
import { CHAT_OPEN } from '@services/eventsHub'
import { padUrl } from '@services/padUrl'
import { useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { copyLinkToClipboard } from '@utils/clipboard'
import PubSub from 'pubsub-js'

import {
  navigateToDocTitle as navigateToDocTitleAction,
  navigateToHeading as navigateToHeadingAction
} from '../utils/navigateToHeading'

function editorOrNull() {
  return useStore.getState().settings.editor.instance
}

/** Reads the editor at confirm time, not at open, so it acts on the live instance. */
function removeSectionNow(headingId: string): void {
  const editor = editorOrNull()
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

/** Call-time getState — one stable object, no per-row subscriptions. */
export const tocActions = {
  openChatroom(headingId: string, options?: { scrollTo?: boolean; focusEditor?: boolean }): void {
    PubSub.publish(CHAT_OPEN, {
      headingId,
      scrollTo: options?.scrollTo ?? false,
      ...(options?.focusEditor !== undefined && { focusEditor: options.focusEditor })
    })
  },

  /** Never sets focusEditor. */
  navigateToHeading(
    headingId: string,
    options?: { openChat?: boolean; updateUrl?: boolean }
  ): void {
    if (!editorOrNull()) return
    navigateToHeadingAction(headingId, options)
  },

  navigateToDocTitle(options: { openChat?: boolean }): void {
    navigateToDocTitleAction({
      workspaceId: useStore.getState().settings.metadata.documentId,
      openChat: options.openChat
    })
  },

  async copyLink(headingId: string): Promise<void> {
    if (!headingId) return

    const success = await copyLinkToClipboard(padUrl.link({ kind: 'heading', headingId }))
    if (success) {
      toast.Success('Section link copied')
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

    void padUrl.go({ kind: 'focus', headingId, term: headingText })
  },

  deleteSection(headingId: string): void {
    if (!headingId) return
    openConfirmDialog({
      title: 'Delete this section?',
      body: 'This removes the heading and everything under it.',
      confirmLabel: 'Delete section',
      onConfirm: () => removeSectionNow(headingId)
    })
  }
}
