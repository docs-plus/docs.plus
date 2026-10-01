import { describe, expect, it } from 'bun:test'

import type { DigestDocument } from '../types'
import {
  buildDigestEmail,
  fitDigestDocuments,
  buildListUnsubscribeHeaders,
  buildNotificationEmailText,
  getEmailSubject,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from '../../index'
// Both are internal to the package now, and this test lives inside it.
import { changeWindowLine, contributorLine } from '../helpers'

const NOTIFICATION_PARAMS = {
  recipientName: 'Jane Smith',
  senderName: 'John Doe',
  notificationType: 'mention' as const,
  messagePreview: 'Hey @Jane, can you review the API docs?',
  actionUrl: 'https://docs.plus/api-docs?chatroom=general',
  documentName: 'API Documentation',
  channelName: 'general'
}

const DIGEST_PARAMS = {
  recipientName: 'Jane Smith',
  frequency: 'daily' as const,
  documents: [
    {
      name: 'API Documentation',
      slug: 'api-docs',
      url: 'https://docs.plus/api-docs',
      channels: [
        {
          name: 'general',
          id: 'ch-001',
          url: 'https://docs.plus/api-docs?chatroom=ch-001',
          notifications: [
            {
              type: 'mention',
              sender_name: 'John Doe',
              message_preview: 'Hey @Jane, review the auth section?',
              action_url: 'https://docs.plus/api-docs?chatroom=ch-001',
              created_at: '2026-02-17T10:00:00Z'
            },
            {
              type: 'reply',
              sender_name: 'Alice Chen',
              message_preview: 'Added rate limiting docs.',
              action_url: 'https://docs.plus/api-docs?chatroom=ch-001',
              created_at: '2026-02-17T08:00:00Z'
            }
          ]
        }
      ]
    }
  ] satisfies DigestDocument[],
  periodEnd: '2026-02-17T00:00:00Z'
}

const DIGEST_CHANGES_PARAMS = {
  ...DIGEST_PARAMS,
  documents: [
    {
      ...DIGEST_PARAMS.documents[0],
      content_changes: {
        document_id: 'Zrl8S6a5609d4ViFEf5',
        // Older than seven days for good, so the rendered line stays the date
        // shape and this snapshot cannot drift with the clock.
        since: '2026-02-16T00:00:00Z',
        fromLastLeft: true,
        sections: [
          {
            text: 'Rate limiting',
            url: 'https://docs.plus/api-docs?id=rate-limiting'
          },
          {
            text: 'Retries',
            url: 'https://docs.plus/api-docs?id=retries',
            tocId: 'retries',
            runs: [
              { kind: 'same', text: 'Retries use ' },
              { kind: 'removed', text: 'a new' },
              { kind: 'added', text: 'the same' },
              { kind: 'same', text: ' key.' }
            ]
          }
        ]
      }
    }
  ] satisfies DigestDocument[]
}

const NEW_DOC_PARAMS = {
  documentName: 'Product Roadmap Q1',
  documentUrl: 'https://docs.plus/product-roadmap-q1',
  creatorName: 'Alice Chen',
  creatorEmail: 'alice@example.com',
  createdAt: '2026-02-17T12:00:00Z',
  slug: 'product-roadmap-q1',
  documentId: 'doc-abc-123'
}

describe('renderNotificationEmail', () => {
  it('renders a valid HTML document', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes recipient name', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('Jane Smith')
  })

  it('includes sender name', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('John Doe')
  })

  it('includes message preview', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('Hey @Jane, can you review the API docs?')
  })

  it('includes action URL', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('https://docs.plus/api-docs?chatroom=general')
  })

  it('includes document and channel context', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('API Documentation')
    expect(html).toContain('#general')
  })

  it('uses fallback greeting when recipientName is empty', () => {
    const html = renderNotificationEmail({ ...NOTIFICATION_PARAMS, recipientName: '' })
    expect(html).toContain('Hi there')
  })

  it('renders correct subject in body', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('John Doe mentioned you')
  })

  it('snapshot', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toMatchSnapshot()
  })
})

describe('buildDigestEmail', () => {
  it('renders a valid HTML document', () => {
    const { html } = buildDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes frequency label', () => {
    const { subject } = buildDigestEmail(DIGEST_PARAMS)
    expect(subject).toContain('daily digest')
  })

  it('includes notification count', () => {
    const { subject } = buildDigestEmail(DIGEST_PARAMS)
    expect(subject).toContain('2 notifications')
  })

  it('includes document name', () => {
    const { html } = buildDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('API Documentation')
  })

  it('includes channel name', () => {
    const { html } = buildDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('# general')
  })

  it('includes sender names', () => {
    const { html } = buildDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('John Doe')
    expect(html).toContain('Alice Chen')
  })

  it('snapshot', () => {
    const { html } = buildDigestEmail(DIGEST_PARAMS)
    expect(html).toMatchSnapshot()
  })

  it('shows the added and removed words under a heading that opens that place', () => {
    const { html, text } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            sections: [
              {
                ...DIGEST_CHANGES_PARAMS.documents[0].content_changes.sections[0],
                excerpt: 'Requests over the cap wait.',
                removed: 'Requests over the cap fail.',
                tocId: 'rate-limiting'
              }
            ]
          }
        }
      ]
    })
    expect(html).toContain('Requests over the cap wait.')
    expect(html).toContain('Requests over the cap fail.')
    expect(html).toContain('https://docs.plus/api-docs?id=rate-limiting')
    expect(html).toContain('font-weight: 700')
    expect(text).toContain('{+Requests over the cap wait.+}')
    expect(text).toContain('[-Requests over the cap fail.-]')
    expect(text).toContain('https://docs.plus/api-docs?id=rate-limiting')
  })

  it('paints the changed passage under the heading', () => {
    const { html, text } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            sections: [
              {
                ...DIGEST_CHANGES_PARAMS.documents[0].content_changes.sections[0],
                tocId: 'rate-limiting',
                chats: [
                  {
                    type: 'message' as const,
                    sender_name: 'Alice',
                    message_preview: 'The cap should wait, not fail.',
                    action_url: 'https://docs.plus/api-docs?chatroom=rate-limiting',
                    created_at: '2026-02-16T10:00:00.000Z'
                  }
                ],
                runs: [
                  { kind: 'same', text: 'Requests over the cap ' },
                  { kind: 'removed', text: 'fail' },
                  { kind: 'added', text: ' wait' },
                  {
                    kind: 'same',
                    text: '. Later retries use the same key and stay in the queue until a slot opens.'
                  }
                ]
              }
            ]
          }
        }
      ]
    })
    expect(html).toContain('Requests over the cap')
    expect(html).toContain('background-color:#fee2e2')
    expect(html).toContain('background-color:#d1fae5')
    expect(html).not.toContain('<details>')
    expect(html).toContain('Later retries use the same key')
    expect(html).toContain('https://docs.plus/api-docs?id=rate-limiting')
    expect(html).toContain('Alice')
    expect(html).toContain('The cap should wait, not fail.')
    expect(text).toContain('Requests over the cap [-fail-]{+ wait+}.')
    expect(text).toContain('Alice: The cap should wait, not fail.')
    expect(text).toContain('Later retries use the same key')
    expect(text).not.toContain('More:')
  })

  it('drops the oldest chat before it shortens a changed heading', () => {
    const documents = [
      {
        name: 'Pad',
        slug: 'pad',
        url: 'https://docs.plus/pad',
        channels: [
          {
            name: 'general',
            id: 'room-general',
            url: 'https://docs.plus/pad?chatroom=room-general',
            notifications: [
              {
                type: 'message' as const,
                sender_name: 'Ann',
                message_preview: 'stay in the card',
                action_url: 'https://docs.plus/pad?chatroom=room-general',
                created_at: '2026-09-01T00:00:00.000Z'
              }
            ]
          }
        ],
        content_changes: {
          document_id: 'pad',
          since: '2026-09-01T00:00:00.000Z',
          fromLastLeft: false,
          sections: [
            {
              text: 'Bugs',
              url: 'https://docs.plus/pad?id=bugs',
              runs: [
                {
                  kind: 'same' as const,
                  text: `${'word '.repeat(800)}The edit stays. The rest of this passage is only context.`
                }
              ],
              chats: [
                {
                  type: 'message' as const,
                  sender_name: 'Old',
                  message_preview: 'oldest chat should go',
                  action_url: 'https://docs.plus/pad?chatroom=bugs',
                  created_at: '2026-09-01T01:00:00.000Z'
                },
                {
                  type: 'message' as const,
                  sender_name: 'New',
                  message_preview: 'newer chat stays if it fits',
                  action_url: 'https://docs.plus/pad?chatroom=bugs',
                  created_at: '2026-09-02T01:00:00.000Z'
                }
              ]
            }
          ]
        }
      }
    ] satisfies DigestDocument[]
    const params = {
      recipientName: 'Ada',
      frequency: 'daily' as const,
      documents,
      periodEnd: '2026-09-03T00:00:00.000Z'
    }
    const full = buildDigestEmail(params)
    const limit = Buffer.byteLength(full.html, 'utf8') - 1
    const fitted = fitDigestDocuments(params, limit)
    const { html } = buildDigestEmail({ ...params, documents: fitted })
    expect(html).toContain('Bugs')
    expect(html).not.toContain('oldest chat should go')
    expect(html).toContain('stay in the card')
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThanOrEqual(limit)
  })

  it('keeps every later edit when the fit shortens a passage', () => {
    const documents = [
      {
        name: 'Pad',
        slug: 'pad',
        url: 'https://docs.plus/pad',
        channels: [],
        content_changes: {
          document_id: 'pad',
          since: '2026-09-01T00:00:00.000Z',
          fromLastLeft: false,
          sections: [
            {
              text: 'Bugs',
              url: 'https://docs.plus/pad?id=bugs',
              runs: [
                { kind: 'added' as const, text: 'First edit' },
                { kind: 'same' as const, text: ` stays. ${'context '.repeat(400)}` },
                { kind: 'added' as const, text: 'Second edit' }
              ]
            }
          ]
        }
      }
    ] satisfies DigestDocument[]
    const params = {
      recipientName: 'Ada',
      frequency: 'daily' as const,
      documents,
      periodEnd: '2026-09-03T00:00:00.000Z'
    }
    const limit = Buffer.byteLength(buildDigestEmail(params).html, 'utf8') - 1
    const { html } = buildDigestEmail({ ...params, documents: fitDigestDocuments(params, limit) })
    expect(html).toContain('First edit')
    expect(html).toContain('Second edit')
    expect(html).not.toContain('context context context')
  })

  it('names Last left in the changed-document line', () => {
    const { html } = buildDigestEmail(DIGEST_CHANGES_PARAMS)
    // The fixture's `since` and `periodEnd` are one day apart, so this value is
    // fixed. It read "on 16 Feb 2026" while the render anchored on wall clock,
    // which made the assertion drift with the calendar.
    expect(html).toContain('Changed since you left, 1 day ago.')
  })

  it('names the resolved start when the window is wider than the frequency', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            since: '2026-01-01T00:00:00Z',
            fromLastLeft: false
          }
        }
      ]
    })
    expect(html).toContain('Changed since 1 Jan 2026.')
    expect(html).not.toContain('since you left')
    expect(html).not.toContain('in the last day')
  })

  it('falls back to the frequency window when the reader never left', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            fromLastLeft: false
          }
        }
      ]
    })
    expect(html).toContain('Changed in the last day.')
    expect(html).not.toContain('since you left')
  })

  // A digest renders from a queued payload, so wall clock at render sits past
  // the window the sections were computed for. Anchoring on `Date.now()` made
  // the phrase disagree with the `since` printed beside it.
  it('measures the window against periodEnd, not the clock at render', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      periodEnd: '2026-02-16T02:00:00Z',
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            since: '2026-02-16T00:00:00Z'
          }
        }
      ]
    })
    expect(html).toContain('Changed since you left, 2 hours ago.')
    // Wall clock is far past that window, so an unanchored render says this.
    expect(html).not.toContain('on 16 Feb 2026')
  })

  // The count is a floor and can legitimately be 0, so an ungated render would
  // print "0 people contributed." under a card that lists real changes.
  it('prints no contributor line when the count is 0', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            contributorCount: 0
          }
        }
      ]
    })
    expect(html).not.toContain('contributed')
  })

  it('prints the contributor line when the count is 1 or more', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_CHANGES_PARAMS,
      documents: [
        {
          ...DIGEST_CHANGES_PARAMS.documents[0],
          content_changes: {
            ...DIGEST_CHANGES_PARAMS.documents[0].content_changes,
            contributorCount: 3
          }
        }
      ]
    })
    expect(html).toContain('3 people contributed.')
  })

  // `${APP_URL}/notifications` is not a route: it opens a blank pad named
  // "notifications". The panel is user scoped, so the first document reaches it.
  it('points View All Notifications at the first document, after its query', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_PARAMS,
      documents: [
        { ...DIGEST_PARAMS.documents[0], url: 'https://docs.plus/api-docs?chatroom=ch-001' }
      ]
    })
    expect(html).toContain('https://docs.plus/api-docs?chatroom=ch-001#notifications')
  })

  it('falls back to the app URL when the digest carries no document', () => {
    const { html } = buildDigestEmail({ ...DIGEST_PARAMS, documents: [] })
    expect(html).toContain('href="https://docs.plus" ')
    expect(html).not.toContain('#notifications')
  })

  it('snapshot — content changes', () => {
    const { html } = buildDigestEmail(DIGEST_CHANGES_PARAMS)
    expect(html).toMatchSnapshot()
  })

  // Gmail drops inline SVG, `position` and negative margins, which left a blank
  // mark and a loose badge dot in the live digest.
  it('draws the sheet header with images and tables only', () => {
    const { html } = buildDigestEmail(DIGEST_CHANGES_PARAMS)
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('position:')
    expect(html).not.toMatch(/margin[a-z-]*:\s*-/)
    expect(html).toContain('https://docs.plus/email/mark.png')
    expect(html).toContain('https://docs.plus/email/bell.png')
  })
})

describe('changeWindowLine', () => {
  const NOW = Date.parse('2026-09-07T14:00:00Z')
  const MINUTE = 60_000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const since = (elapsed: number) => new Date(NOW - elapsed).toISOString()

  it('reads "just now" under two minutes', () => {
    expect(changeWindowLine(since(90 * 1000), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, just now.'
    )
  })

  it('reads minutes from two minutes up', () => {
    expect(changeWindowLine(since(2 * MINUTE), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, 2 minutes ago.'
    )
    expect(changeWindowLine(since(30 * MINUTE), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, 30 minutes ago.'
    )
  })

  it('reads hours from one hour up, singular at one', () => {
    expect(changeWindowLine(since(HOUR), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, 1 hour ago.'
    )
    expect(changeWindowLine(since(5 * HOUR), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, 5 hours ago.'
    )
  })

  it('reads days from one day up, singular at one', () => {
    expect(changeWindowLine(since(DAY), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, 1 day ago.'
    )
    expect(changeWindowLine(since(3 * DAY), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, 3 days ago.'
    )
  })

  it('reads a date from seven days up', () => {
    expect(changeWindowLine(since(7 * DAY), true, 'weekly', NOW)).toBe(
      '✏️ Changed since you left, on 31 Aug 2026.'
    )
    expect(changeWindowLine(since(39 * DAY), true, 'weekly', NOW)).toBe(
      '✏️ Changed since you left, on 30 Jul 2026.'
    )
  })

  it('reads the frequency window when the reader never left', () => {
    expect(changeWindowLine(since(30 * MINUTE), false, 'daily', NOW)).toBe(
      '✏️ Changed in the last day.'
    )
    expect(changeWindowLine(since(30 * MINUTE), false, 'weekly', NOW)).toBe(
      '✏️ Changed in the last week.'
    )
  })

  it('falls back to the frequency window on an unparseable since', () => {
    expect(changeWindowLine('not a date', true, 'daily', NOW)).toBe('✏️ Changed in the last day.')
  })

  it('reads "just now" when a skewed clock puts since in the future', () => {
    expect(changeWindowLine(since(-5 * MINUTE), true, 'daily', NOW)).toBe(
      '✏️ Changed since you left, just now.'
    )
  })
})

describe('contributorLine', () => {
  it('renders nothing when the count is absent or under 1', () => {
    expect(contributorLine(undefined)).toBe('')
    expect(contributorLine(0)).toBe('')
  })

  it('reads singular at one and plural above it', () => {
    expect(contributorLine(1)).toBe('👤 1 person contributed.')
    expect(contributorLine(2)).toBe('👥 2 people contributed.')
  })
})

describe('renderNewDocumentEmail', () => {
  it('renders a valid HTML document', () => {
    const html = renderNewDocumentEmail(NEW_DOC_PARAMS)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes document name', () => {
    const html = renderNewDocumentEmail(NEW_DOC_PARAMS)
    expect(html).toContain('Product Roadmap Q1')
  })

  it('includes creator info', () => {
    const html = renderNewDocumentEmail(NEW_DOC_PARAMS)
    expect(html).toContain('Alice Chen')
    expect(html).toContain('alice@example.com')
  })

  it('includes slug and document ID', () => {
    const html = renderNewDocumentEmail(NEW_DOC_PARAMS)
    expect(html).toContain('product-roadmap-q1')
    expect(html).toContain('doc-abc-123')
  })

  it('includes CTA button with document URL', () => {
    const html = renderNewDocumentEmail(NEW_DOC_PARAMS)
    expect(html).toContain('https://docs.plus/product-roadmap-q1')
    expect(html).toContain('View Document')
  })

  it('snapshot', () => {
    const html = renderNewDocumentEmail(NEW_DOC_PARAMS)
    expect(html).toMatchSnapshot()
  })
})

describe('renderUnsubscribePage', () => {
  it('renders success state', () => {
    const html = renderUnsubscribePage({ title: 'Unsubscribed', message: 'Done.' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Unsubscribed')
    expect(html).toContain('Done.')
  })

  it('renders error state', () => {
    const html = renderUnsubscribePage({ title: 'Error', message: 'Expired.' })
    expect(html).toContain('Error')
    expect(html).toContain('Expired.')
  })

  it('always shows the manage preferences link', () => {
    const html = renderUnsubscribePage({ title: 'OK', message: 'OK' })
    expect(html).toContain('Manage preferences')
    expect(html).toContain('/#settings?tab=notifications')
  })

  it('shows the home link when requested', () => {
    const html = renderUnsubscribePage({ title: 'OK', message: 'OK', showHomeLink: true })
    expect(html).toContain('Go to docs.plus')
  })

  it('hides email when not provided', () => {
    const html = renderUnsubscribePage({ title: 'OK', message: 'OK' })
    expect(html).not.toContain('class="email"')
  })

  it('shows email when provided', () => {
    const html = renderUnsubscribePage({
      title: 'OK',
      message: 'OK',
      email: 'jane@example.com'
    })
    expect(html).toContain('jane@example.com')
  })

  it('snapshot — success', () => {
    const html = renderUnsubscribePage({
      title: 'Unsubscribed',
      message: 'You have been unsubscribed.',
      email: 'jane@example.com',
      showHomeLink: true
    })
    expect(html).toMatchSnapshot()
  })

  it('snapshot — error', () => {
    const html = renderUnsubscribePage({
      title: 'Invalid Link',
      message: 'The link is expired.'
    })
    expect(html).toMatchSnapshot()
  })
})

describe('XSS protection (autoEscape)', () => {
  it('escapes HTML in recipient name', () => {
    const html = renderNotificationEmail({
      ...NOTIFICATION_PARAMS,
      recipientName: '<script>alert("xss")</script>'
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in sender name', () => {
    const html = renderNotificationEmail({
      ...NOTIFICATION_PARAMS,
      senderName: '<img src=x onerror=alert(1)>'
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('escapes HTML in message preview', () => {
    const html = renderNotificationEmail({
      ...NOTIFICATION_PARAMS,
      messagePreview: '<b onmouseover=alert(1)>hover</b>'
    })
    expect(html).not.toContain('<b onmouseover')
    expect(html).toContain('&lt;b onmouseover')
  })

  it('escapes HTML in document name', () => {
    const html = renderNotificationEmail({
      ...NOTIFICATION_PARAMS,
      documentName: '"><script>alert(1)</script>'
    })
    expect(html).not.toContain('<script>alert')
  })

  it('escapes HTML in unsubscribe page title', () => {
    const html = renderUnsubscribePage({
      title: '<script>alert("xss")</script>',
      message: 'test'
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in unsubscribe page message', () => {
    const html = renderUnsubscribePage({
      title: 'Test',
      message: '<img src=x onerror=alert(1)>'
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('escapes HTML in digest sender names', () => {
    const { html } = buildDigestEmail({
      ...DIGEST_PARAMS,
      documents: [
        {
          ...DIGEST_PARAMS.documents[0],
          channels: [
            {
              ...DIGEST_PARAMS.documents[0].channels[0],
              notifications: [
                {
                  ...DIGEST_PARAMS.documents[0].channels[0].notifications[0],
                  sender_name: '<script>evil</script>'
                }
              ]
            }
          ]
        }
      ]
    })
    expect(html).not.toContain('<script>evil')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('getEmailSubject', () => {
  it('returns correct subject for mention', () => {
    expect(getEmailSubject('mention', 'John')).toBe('John mentioned you')
  })

  it('returns correct subject for reply', () => {
    expect(getEmailSubject('reply', 'Alice')).toBe('Alice replied to your message')
  })

  it('returns correct subject for reaction', () => {
    expect(getEmailSubject('reaction', 'Bob')).toBe('Bob reacted to your message')
  })

  it('returns correct subject for thread_message', () => {
    expect(getEmailSubject('thread_message', 'Eve')).toBe('Eve replied in a thread')
  })

  it('returns correct subject for message', () => {
    expect(getEmailSubject('message', 'Frank')).toBe('Frank sent a message')
  })

  it('returns correct subject for channel_event', () => {
    expect(getEmailSubject('channel_event', 'Grace')).toBe('Grace made an announcement')
  })

  it('returns fallback for unknown type', () => {
    expect(getEmailSubject('unknown', 'X')).toBe('New notification')
  })

  it('falls back to "Someone" when senderName is empty', () => {
    expect(getEmailSubject('mention', '')).toBe('Someone mentioned you')
  })
})

describe('buildListUnsubscribeHeaders', () => {
  it('returns RFC 8058 compliant headers', () => {
    const headers = buildListUnsubscribeHeaders('https://example.com/unsub?token=abc')
    expect(headers).toEqual({
      'List-Unsubscribe': '<https://example.com/unsub?token=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    })
  })
})

describe('design tokens', () => {
  it('uses FONT_STACK from tokens in base layout', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('font-family: Helvetica, Arial, sans-serif;')
  })

  it('uses COLORS.primary in header', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('#1a73e8')
  })

  it('includes copyright with current year', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    const year = new Date().getFullYear().toString()
    expect(html).toContain(`&copy; ${year}`)
  })
})

/**
 * A past bug left the HTML part working while the plain-text part shipped a
 * tokenless link, inside one message. Mail clients pick one part, so both must
 * offer the same link, with the same label.
 */
describe('both parts of one mail carry the same footer', () => {
  const footer = {
    unsubscribeUrl: 'https://docs.plus/unsubscribe?token=REPLIES',
    unsubscribeText: 'Unsubscribe from replies',
    preferencesUrl: 'https://docs.plus/#settings?tab=notifications'
  }

  it('renders the same URL and the same label in both parts', () => {
    const params = {
      recipientName: 'Jane',
      senderName: 'Sam',
      notificationType: 'reply' as const,
      messagePreview: 'hi',
      actionUrl: 'https://docs.plus/doc',
      footer
    }
    for (const body of [renderNotificationEmail(params), buildNotificationEmailText(params)]) {
      expect(body).toContain(footer.unsubscribeUrl)
      expect(body).toContain(footer.unsubscribeText)
    }
  })

  it('carries the digest footer through both parts of a digest', () => {
    const digestFooter = { ...footer, unsubscribeText: 'Unsubscribe from digests' }
    const digest = buildDigestEmail({
      recipientName: 'Jane',
      frequency: 'daily' as const,
      documents: [],
      periodEnd: new Date(0).toISOString(),
      footer: digestFooter
    })
    for (const body of [digest.html, digest.text]) {
      expect(body).toContain(digestFooter.unsubscribeText)
    }
  })

  // The label and the URL come from one object, so they cannot describe
  // different scopes. That mismatch was a real defect: a link labelled
  // "Unsubscribe from replies" once carried the all-mail token.
  it('never shows a narrow label over a broad link', () => {
    const html = renderNotificationEmail({
      recipientName: 'Jane',
      senderName: 'Sam',
      notificationType: 'reply' as const,
      messagePreview: 'hi',
      actionUrl: 'https://docs.plus/doc',
      footer: { ...footer, unsubscribeUrl: 'https://docs.plus/unsubscribe?token=ALL' }
    })
    // Whatever the caller passed is what renders. No hidden widening.
    expect(html).toContain('token=ALL')
    expect(html).toContain('Unsubscribe from replies')
  })

  // Without a secret the sender passes no footer. The link is then tokenless,
  // and the label must not claim a scope the link does not carry.
  it('offers a plain, unscoped label when no footer is supplied', () => {
    const text = buildNotificationEmailText({
      recipientName: 'Jane',
      senderName: 'Sam',
      notificationType: 'mention' as const,
      messagePreview: 'hi',
      actionUrl: 'https://docs.plus/doc'
    })
    expect(text).toContain('/unsubscribe')
    expect(text).not.toContain('token=')
    expect(text).not.toContain('Unsubscribe from')
  })
})
