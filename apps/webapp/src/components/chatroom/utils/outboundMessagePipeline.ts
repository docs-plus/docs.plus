import type { SendDraft, SendResult } from '@components/chatroom/types/send.types'
import { ensureChatMediaInsertReady } from '@components/chatroom/utils/chatMediaStorageReadiness'
import { editHadPersistedMedias } from '@components/chatroom/utils/composerSendGate'
import {
  messageMediasForInsert,
  resolveOutgoingMessageType
} from '@components/chatroom/utils/messageMediaPaths'
import type { Editor } from '@tiptap/react'
import type {
  CommentAnchorV1,
  CommentMessageMemory,
  ComposerMessageMemory,
  Database,
  MessageMediaItem
} from '@types'
import { chunkHtmlContent } from '@utils/chunkHtmlContent'
import { sanitizeMessageContent } from '@utils/sanitizeContent'

export type OutboundComposerMode =
  | { kind: 'edit'; editMemory: ComposerMessageMemory }
  | { kind: 'comment'; commentMemory: CommentMessageMemory }
  | { kind: 'send'; replyToId: string | null }

export type EditMediasPatch =
  { kind: 'omit' } | { kind: 'set'; medias: MessageMediaItem[] } | { kind: 'clear' }

export type OutboundChunkPayload = {
  content: string
  html: string
  medias?: MessageMediaItem[] | null
  type?: Database['public']['Enums']['message_type']
}

export type PreparedOutboundContent = {
  sanitizedHtml: string
  sanitizedText: string
  htmlChunks: string[]
  textChunks: string[]
  hasAttachments: boolean
  mediasToSend: MessageMediaItem[] | null
  editMediasPatch: EditMediasPatch | undefined
  outgoingType: Database['public']['Enums']['message_type'] | undefined
  mode: OutboundComposerMode
  shouldClearComposerEarly: boolean
}

export type PrepareOutboundError = { ok: false; error: string }
export type PrepareOutboundSuccess = { ok: true } & PreparedOutboundContent

export type PrepareOutboundResult = PrepareOutboundSuccess | PrepareOutboundError

const clearsComposerBeforeSend = (
  htmlChunkCount: number,
  editMessageMemory: ComposerMessageMemory | null | undefined
): boolean => htmlChunkCount === 0 && !editMessageMemory

const resolveEditMediasPatch = (
  editMessageMemory: ComposerMessageMemory | null | undefined,
  readyMedias: MessageMediaItem[],
  mediasForInsert: MessageMediaItem[] | null
): EditMediasPatch | undefined => {
  if (!editMessageMemory) return undefined
  const hadPersisted = editHadPersistedMedias(editMessageMemory)
  if (!hadPersisted && readyMedias.length === 0) return { kind: 'omit' }
  if (readyMedias.length === 0 && hadPersisted) return { kind: 'clear' }
  return { kind: 'set', medias: mediasForInsert ?? [] }
}

export function prepareOutboundContent(
  editor: Editor,
  readyMedias: MessageMediaItem[],
  editMessageMemory: ComposerMessageMemory | null | undefined,
  commentMessageMemory: CommentMessageMemory | null | undefined,
  replyToId: string | null
): PrepareOutboundResult {
  const hasAttachments = readyMedias.length > 0

  try {
    const html = editor.getHTML()
    const text = editor.getText()
    const sanitized = sanitizeMessageContent(html, text)
    if (!hasAttachments && (!sanitized.sanitizedHtml || !sanitized.sanitizedText)) {
      return { ok: false, error: 'Invalid content detected' }
    }

    const sanitizedHtml = sanitized.sanitizedHtml ?? ''
    const sanitizedText = sanitized.sanitizedText ?? ''
    const chunks = chunkHtmlContent(sanitizedHtml, 3000)
    const htmlChunks = chunks.htmlChunks
    const textChunks = chunks.textChunks

    if (hasAttachments && htmlChunks.length > 1) {
      return {
        ok: false,
        error: 'Attachments cannot be sent with messages over 3,000 characters'
      }
    }

    const outgoingType = hasAttachments
      ? resolveOutgoingMessageType(sanitizedText, readyMedias)
      : undefined
    const mediasToSend = hasAttachments ? messageMediasForInsert(readyMedias) : null
    const editMediasPatch = resolveEditMediasPatch(editMessageMemory, readyMedias, mediasToSend)

    let mode: OutboundComposerMode
    if (editMessageMemory) {
      mode = { kind: 'edit', editMemory: editMessageMemory }
    } else if (commentMessageMemory) {
      mode = { kind: 'comment', commentMemory: commentMessageMemory }
    } else {
      mode = { kind: 'send', replyToId }
    }

    return {
      ok: true,
      sanitizedHtml,
      sanitizedText,
      htmlChunks,
      textChunks,
      hasAttachments,
      mediasToSend,
      editMediasPatch,
      outgoingType,
      mode,
      shouldClearComposerEarly: clearsComposerBeforeSend(htmlChunks.length, editMessageMemory)
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid content'
    }
  }
}

export async function ensureOutboundStorageReady(
  prepared: PreparedOutboundContent
): Promise<boolean> {
  let medias = prepared.mediasToSend
  if (!medias?.length && prepared.editMediasPatch?.kind === 'set') {
    medias = prepared.editMediasPatch.medias.length > 0 ? prepared.editMediasPatch.medias : null
  }
  if (!medias?.length) return true
  return ensureChatMediaInsertReady(medias)
}

const buildEditChunkPayload = (
  content: string,
  html: string,
  patch: EditMediasPatch,
  hasAttachments: boolean,
  outgoingType: Database['public']['Enums']['message_type'] | undefined
): OutboundChunkPayload => {
  switch (patch.kind) {
    case 'omit':
      return { content, html }
    case 'clear':
      return { content, html, medias: null, type: outgoingType ?? 'text' }
    case 'set':
      return {
        content,
        html,
        medias: patch.medias,
        type: hasAttachments ? (outgoingType ?? 'text') : undefined
      }
    default: {
      const _exhaustive: never = patch
      return _exhaustive
    }
  }
}

/** Per-chunk payload for the active mode; only chunk 0 carries medias. */
export function buildOutboundChunkPayload(
  prepared: PreparedOutboundContent,
  content: string,
  html: string,
  chunkIndex: number
): OutboundChunkPayload {
  const { mode, mediasToSend, editMediasPatch, outgoingType, hasAttachments } = prepared

  if (mode.kind === 'edit') {
    return buildEditChunkPayload(
      content,
      html,
      editMediasPatch ?? { kind: 'omit' },
      hasAttachments,
      outgoingType
    )
  }

  if (mode.kind === 'comment') {
    if (hasAttachments && chunkIndex === 0) {
      return { content, html, medias: mediasToSend, type: outgoingType ?? 'comment' }
    }
    return { content, html }
  }

  if (chunkIndex !== 0 || !mediasToSend?.length) {
    return { content, html }
  }
  return { content, html, medias: mediasToSend, type: outgoingType }
}

export function buildSendDraftFromChunk(
  payload: OutboundChunkPayload,
  replyToId: string | null
): SendDraft {
  const draft: SendDraft = {
    content: payload.content,
    html: payload.html,
    reply_to_message_id: replyToId
  }
  if (payload.medias != null && payload.medias.length > 0) {
    draft.medias = payload.medias
    draft.type = payload.type
    draft.storageVerified = true
  }
  return draft
}

export type OutboundDispatchDeps = {
  channelId: string
  userId: string
  contextSend: (draft: SendDraft) => Promise<SendResult>
  updateMsg: (
    content: string,
    html: string,
    messageId: string,
    options: {
      medias?: MessageMediaItem[] | null
      type?: Database['public']['Enums']['message_type']
    }
  ) => Promise<unknown>
  sendComment: (
    content: string,
    channelId: string,
    userId: string,
    html: string,
    anchor: CommentAnchorV1,
    options: {
      medias?: MessageMediaItem[] | null
      type?: Database['public']['Enums']['message_type']
    }
  ) => Promise<unknown>
  flushRemovedPersistedStorage: () => void
}

export async function dispatchOutboundChunk(
  prepared: PreparedOutboundContent,
  content: string,
  html: string,
  chunkIndex: number,
  deps: OutboundDispatchDeps
): Promise<void> {
  const payload = buildOutboundChunkPayload(prepared, content, html, chunkIndex)

  if (prepared.mode.kind === 'edit') {
    await deps.updateMsg(content, html, prepared.mode.editMemory.id!, {
      ...(payload.medias !== undefined ? { medias: payload.medias } : {}),
      type: payload.type
    })
    deps.flushRemovedPersistedStorage()
    return
  }

  if (prepared.mode.kind === 'comment') {
    await deps.sendComment(
      content,
      deps.channelId,
      deps.userId,
      html,
      prepared.mode.commentMemory.anchor,
      {
        ...(payload.medias != null && payload.type
          ? { medias: payload.medias, type: payload.type }
          : {})
      }
    )
    return
  }

  const result = await deps.contextSend(buildSendDraftFromChunk(payload, prepared.mode.replyToId))
  // persistChatMessage already reported 'failed' (and auth gates aren't errors);
  // flag the wrapper so the composer's catch toasts without a second capture.
  if (result === 'auth_required') throw markAlreadyCaptured(new Error('Not authenticated'))
  if (result === 'failed') throw markAlreadyCaptured(new Error('Failed to send message'))
}

const markAlreadyCaptured = (error: Error) => Object.assign(error, { alreadyCaptured: true })

export const isAlreadyCapturedError = (error: unknown): boolean =>
  error instanceof Error && 'alreadyCaptured' in error
