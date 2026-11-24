import { describe, expect, it } from 'bun:test'

import {
  countComponents,
  DISCORD_COLORS,
  IS_COMPONENTS_V2_FLAG,
  renderCard,
  SUPPRESS_NOTIFICATIONS_FLAG,
  totalTextLength
} from '../discord/renderer.ts'

describe('Components V2 renderer', () => {
  it('sets IS_COMPONENTS_V2 flags, allowed_mentions allowlist, and message_reference safety', () => {
    const payload = renderCard({
      accentColor: DISCORD_COLORS.AMBER,
      stateBadge: 'Review Requested',
      title: '#742 Fix heading fold scroll jump',
      primaryButton: { label: 'Open PR ↗', url: 'https://github.com/docs-plus/docs.plus/pull/742' },
      sections: ['Waiting on <@900000000000000001>'],
      buttons: [
        { label: 'View Diff ↗', url: 'https://github.com/docs-plus/docs.plus/pull/742/files' },
        { label: 'Bad JS URL', url: 'javascript:alert(1)' }
      ],
      footer: 'docs-plus/docs.plus',
      silent: false,
      mentionUserIds: ['900000000000000001', 'not-a-snowflake'],
      replyToMessageId: '123456789012345678'
    })

    expect(payload.flags).toBe(IS_COMPONENTS_V2_FLAG)
    expect(payload.allowed_mentions).toEqual({
      parse: [],
      users: ['900000000000000001']
    })
    expect(payload.message_reference).toEqual({
      message_id: '123456789012345678',
      fail_if_not_exists: false
    })

    const row = payload.components[0].components.find((c) => c.type === 1)
    expect(row && row.type === 1 ? row.components.length : 0).toBe(1)
  })

  it('adds SUPPRESS_NOTIFICATIONS when silent and enforces <= 4000 text and <= 40 components', () => {
    const huge = Array.from({ length: 20 }, (_, i) => `word${i} `.repeat(100))
    const payload = renderCard({
      accentColor: DISCORD_COLORS.SLATE,
      stateBadge: 'Push · main',
      title: 'Oversized payload test',
      sections: huge,
      buttons: Array.from({ length: 8 }, (_, i) => ({
        label: `Btn ${i}`,
        url: `https://github.com/docs-plus/docs.plus/${i}`
      })),
      footer: 'docs-plus/docs.plus',
      silent: true
    })

    expect(payload.flags).toBe(IS_COMPONENTS_V2_FLAG | SUPPRESS_NOTIFICATIONS_FLAG)
    expect(totalTextLength(payload.components[0])).toBeLessThanOrEqual(4000)
    expect(countComponents(payload.components[0])).toBeLessThanOrEqual(40)
  })
})
