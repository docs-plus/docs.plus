import {
  composerAttachmentKey,
  useComposerAttachmentsStore
} from '@components/chatroom/stores/composerAttachmentsStore'
import { probeChatMediaObjectMissing } from '@components/chatroom/utils/chatMediaStorageReadiness'
import type { ComposerState } from '@db/messageComposerDB'
import { getComposerState, syncComposerDraft } from '@db/messageComposerDB'
import { useChatStore } from '@stores'
import type { Editor } from '@tiptap/react'
import type { MessageMediaKind } from '@types'
import { useEffect, useRef } from 'react'

import type { ComposerAttachment } from './useComposerAttachments'

export type ComposerAttachmentDraft = {
  id: string
  path: string
  name?: string
  size?: number
  type: MessageMediaKind
}

export const readyAttachmentsToDraft = (
  attachments: ComposerAttachment[]
): ComposerAttachmentDraft[] =>
  attachments
    .filter((entry) => entry.status === 'ready' && entry.item?.path && !entry.persisted)
    .map((entry) => ({
      id: entry.id,
      path: entry.item!.path!,
      name: entry.item!.name,
      size: entry.item!.size,
      type: entry.item!.type
    }))

type Args = {
  workspaceId?: string
  channelId: string
  editor: Editor | null
  attachments: ComposerAttachment[]
  draftHydrated: boolean
  skipHydrate?: boolean
  skipWrite?: boolean
  onHydrateAttachments: (drafts: ComposerAttachmentDraft[]) => void
}

export const useComposerAttachmentDraft = ({
  workspaceId,
  channelId,
  editor,
  attachments,
  draftHydrated,
  skipHydrate = false,
  skipWrite = false,
  onHydrateAttachments
}: Args) => {
  const hydratedAttachmentsRef = useRef(false)

  useEffect(() => {
    hydratedAttachmentsRef.current = false
  }, [channelId, workspaceId])

  useEffect(() => {
    if (!workspaceId || !channelId || skipHydrate || !draftHydrated) return
    if (hydratedAttachmentsRef.current) return

    let cancelled = false
    getComposerState(workspaceId, channelId)
      .then((draft) => {
        if (cancelled) return
        // One read per mount. A later read merges the rows this composer saved, so it would bring
        // back a tile that the user removed since.
        hydratedAttachmentsRef.current = true
        if (!draft?.attachments?.length) return
        const rows = draft.attachments.filter((row): row is ComposerAttachmentDraft =>
          Boolean(row.id && row.path && row.type && typeof row.type === 'string')
        )
        if (rows.length === 0) return
        onHydrateAttachments(rows)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [channelId, draftHydrated, onHydrateAttachments, skipHydrate, workspaceId])

  const lastDraftRef = useRef<string>('')
  const hidDraftRef = useRef(false)

  // Reads the live editor: the 150 ms text state can still hold a caption that was just sent.
  useEffect(() => {
    // An edit or a comment ends with a load of the saved draft. A write before that load stores the
    // mode's text, or deletes the saved draft if Escape emptied the editor. Read the modes from the
    // store: this effect can run late, after a failed comment has put its text back.
    const memory = useChatStore.getState().workspaceSettings.channels.get(channelId)
    const hidesDraft = Boolean(memory?.editMessageMemory || memory?.commentMessageMemory)
    const endsHiddenDraft = hidDraftRef.current && !hidesDraft
    hidDraftRef.current = hidesDraft
    if (!workspaceId || !channelId || skipWrite || !draftHydrated) return
    if (hidesDraft || endsHiddenDraft || !editor || editor.isDestroyed) return

    const readyDraft = readyAttachmentsToDraft(attachments)
    const fingerprint = JSON.stringify(readyDraft)
    if (fingerprint === lastDraftRef.current) return
    lastDraftRef.current = fingerprint

    const state: ComposerState = {
      text: editor.getText(),
      html: editor.getHTML(),
      attachments: readyDraft.length > 0 ? readyDraft : undefined
    }
    syncComposerDraft(workspaceId, channelId, state)
  }, [attachments, channelId, draftHydrated, editor, skipWrite, workspaceId])
}

export const hydrateComposerAttachmentsFromDraft = (
  workspaceId: string,
  channelId: string,
  drafts: ComposerAttachmentDraft[]
) => {
  const key = composerAttachmentKey(workspaceId, channelId)
  const { setAttachments } = useComposerAttachmentsStore.getState()
  let added: ComposerAttachmentDraft[] = []
  // Merge by id, so a same-tab reopen keeps its entries and any upload that restarted.
  setAttachments(key, (prev) => {
    const known = new Set(prev.map((entry) => entry.id))
    added = drafts.filter((draft) => !known.has(draft.id))
    if (added.length === 0) return prev
    return [
      ...prev,
      ...added.map((draft) => ({
        id: draft.id,
        status: 'ready' as const,
        persisted: false,
        item: {
          path: draft.path,
          url: draft.path,
          type: draft.type,
          name: draft.name,
          size: draft.size
        }
      }))
    ]
  })
  // The daily orphan cleanup deletes draft uploads, so a saved row can outlive its upload.
  for (const draft of added) {
    void probeChatMediaObjectMissing(draft.path).then((missing) => {
      if (!missing) return
      setAttachments(key, (prev) =>
        prev.map((entry) =>
          entry.id === draft.id && entry.status === 'ready'
            ? { ...entry, status: 'expired' }
            : entry
        )
      )
    })
  }
}
