import type { MessageMediaItem, MessageMediaKind } from '@types'

import {
  GENERIC_ATTACHMENT_LABEL,
  messageAttachmentPreviewLabel,
  messagePreviewKind
} from './messagePreview'

const media = (type: MessageMediaKind): MessageMediaItem => ({ url: 'x', type })

describe('messagePreview producer/parser round-trip', () => {
  it('maps each single-attachment label back to its kind', () => {
    for (const kind of ['image', 'video', 'audio', 'file'] as const) {
      const label = messageAttachmentPreviewLabel([media(kind)])
      expect(label).not.toBeNull()
      expect(messagePreviewKind(label!)).toBe(kind)
    }
  })

  it('maps the multi-attachment label to "multi"', () => {
    const label = messageAttachmentPreviewLabel([media('image'), media('video')])
    expect(label).toBe('2 attachments')
    expect(messagePreviewKind(label!)).toBe('multi')
  })

  it('maps the generic attachment fallback to "file"', () => {
    expect(messagePreviewKind(GENERIC_ATTACHMENT_LABEL)).toBe('file')
  })

  it('returns null for plain message text', () => {
    expect(messagePreviewKind('see you tomorrow')).toBeNull()
    expect(messagePreviewKind('')).toBeNull()
  })
})
