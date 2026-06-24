import {
  composerAttachmentKey,
  useComposerAttachmentsStore
} from '@components/chatroom/stores/composerAttachmentsStore'
import type { ComposerState } from '@db/messageComposerDB'
import { getComposerState, syncComposerDraft } from '@db/messageComposerDB'
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

const readyAttachmentsToDraft = (attachments: ComposerAttachment[]): ComposerAttachmentDraft[] =>
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
  attachments: ComposerAttachment[]
  draftText: string
  draftHtml: string
  draftHydrated: boolean
  skipDraft?: boolean
  onHydrateAttachments: (drafts: ComposerAttachmentDraft[]) => void
}

export const useComposerAttachmentDraft = ({
  workspaceId,
  channelId,
  attachments,
  draftText,
  draftHtml,
  draftHydrated,
  skipDraft = false,
  onHydrateAttachments
}: Args) => {
  const hydratedAttachmentsRef = useRef(false)
  const draftTextRef = useRef(draftText)
  const draftHtmlRef = useRef(draftHtml)
  draftTextRef.current = draftText
  draftHtmlRef.current = draftHtml

  useEffect(() => {
    hydratedAttachmentsRef.current = false
  }, [channelId, workspaceId])

  useEffect(() => {
    if (!workspaceId || !channelId || skipDraft || !draftHydrated) return
    if (hydratedAttachmentsRef.current) return

    let cancelled = false
    getComposerState(workspaceId, channelId)
      .then((draft) => {
        if (cancelled || !draft?.attachments?.length) return
        const rows = draft.attachments.filter((row): row is ComposerAttachmentDraft =>
          Boolean(row.id && row.path && row.type && typeof row.type === 'string')
        )
        if (rows.length === 0) return
        hydratedAttachmentsRef.current = true
        onHydrateAttachments(rows)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [channelId, draftHydrated, onHydrateAttachments, skipDraft, workspaceId])

  const lastDraftRef = useRef<string>('')

  useEffect(() => {
    if (!workspaceId || !channelId || skipDraft || !draftHydrated) return

    const readyDraft = readyAttachmentsToDraft(attachments)
    const fingerprint = JSON.stringify(readyDraft)
    if (fingerprint === lastDraftRef.current) return
    lastDraftRef.current = fingerprint

    const html = draftHtmlRef.current.trim()
    const state: ComposerState = {
      text: draftTextRef.current,
      html: html.length > 0 ? html : undefined,
      attachments: readyDraft.length > 0 ? readyDraft : undefined
    }
    syncComposerDraft(workspaceId, channelId, state)
  }, [attachments, channelId, draftHydrated, skipDraft, workspaceId])
}

export const hydrateComposerAttachmentsFromDraft = (
  workspaceId: string,
  channelId: string,
  drafts: ComposerAttachmentDraft[]
) => {
  const key = composerAttachmentKey(workspaceId, channelId)
  useComposerAttachmentsStore.getState().setAttachments(
    key,
    drafts.map((draft) => ({
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
  )
}
