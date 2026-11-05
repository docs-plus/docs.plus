import * as toast from '@components/toast'
import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'
import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { CHAT_OPEN } from '@services/eventsHub'
import { padUrl } from '@services/padUrl'
import { useStore } from '@stores'
import { copyLinkToClipboard } from '@utils/clipboard'
import PubSub from 'pubsub-js'

import {
  navigateToDocTitle as navigateToDocTitleAction,
  navigateToHeading as navigateToHeadingAction
} from '../utils/navigateToHeading'
import { outlineOf } from '../utils/outline'

function editorOrNull() {
  return useStore.getState().settings.editor.instance
}

/**
 * Reads the editor at confirm time, not at open, so it acts on the live instance.
 * The Title's section runs to the next H1 or the doc end, so deleting it could empty the pad.
 * tr.delete mutates even a non-editable editor, so the lock check must happen here.
 */
function removeSectionNow(headingId: string): void {
  const editor = editorOrNull()
  if (!editor || editor.isDestroyed) return
  if (isDocumentEditingLocked() || !editor.isEditable) return

  const node = outlineOf(editor.state.doc).find((n) => n.id === headingId)
  if (!node || node.isTitle) return

  editor.view.dispatch(editor.state.tr.delete(node.pos, node.sectionTo))
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
  navigateToHeading(headingId: string, options?: { openChat?: boolean }): void {
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

    const headingText = outlineOf(editor.state.doc)
      .find((n) => n.id === headingId)
      ?.text.trim()
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
