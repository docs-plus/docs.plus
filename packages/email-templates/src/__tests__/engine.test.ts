/**
 * Email Template Engine — Tests
 *
 * Snapshot tests for each template + security / correctness assertions.
 * Run: cd packages/email-templates && bun test
 */

import { describe, expect, it } from 'bun:test'

import {
  buildListUnsubscribeHeaders,
  getEmailSubject,
  renderDigestEmail,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from '../../index'

// ============================================================================
// Fixtures
// ============================================================================

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
  ],
  periodStart: '2026-02-16T00:00:00Z',
  periodEnd: '2026-02-17T00:00:00Z'
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

// ============================================================================
// Render tests
// ============================================================================

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

describe('renderDigestEmail', () => {
  it('renders a valid HTML document', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes frequency label', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('daily digest')
  })

  it('includes notification count', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('2 notifications')
  })

  it('includes document name', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('API Documentation')
  })

  it('includes channel name', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('# general')
  })

  it('includes sender names', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toContain('John Doe')
    expect(html).toContain('Alice Chen')
  })

  it('snapshot', () => {
    const html = renderDigestEmail(DIGEST_PARAMS)
    expect(html).toMatchSnapshot()
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
    const html = renderUnsubscribePage({ success: true, title: 'Unsubscribed', message: 'Done.' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Unsubscribed')
    expect(html).toContain('Done.')
    // Success SVG uses green stroke
    expect(html).toContain('#10b981')
  })

  it('renders error state', () => {
    const html = renderUnsubscribePage({ success: false, title: 'Error', message: 'Expired.' })
    expect(html).toContain('Error')
    expect(html).toContain('Expired.')
    // Error SVG uses red stroke
    expect(html).toContain('#ef4444')
  })

  it('shows manage preferences link when requested', () => {
    const html = renderUnsubscribePage({
      success: true,
      title: 'OK',
      message: 'OK',
      showManageLink: true
    })
    expect(html).toContain('Manage Preferences')
    expect(html).toContain('/settings/notifications')
  })

  it('shows undo link when token provided', () => {
    const html = renderUnsubscribePage({
      success: true,
      title: 'OK',
      message: 'OK',
      showUndoLink: true,
      token: 'abc123'
    })
    expect(html).toContain('Go to docs.plus')
  })

  it('hides email when not provided', () => {
    const html = renderUnsubscribePage({ success: true, title: 'OK', message: 'OK' })
    expect(html).not.toContain('class="email"')
  })

  it('shows email when provided', () => {
    const html = renderUnsubscribePage({
      success: true,
      title: 'OK',
      message: 'OK',
      email: 'jane@example.com'
    })
    expect(html).toContain('jane@example.com')
  })

  it('snapshot — success', () => {
    const html = renderUnsubscribePage({
      success: true,
      title: 'Unsubscribed',
      message: 'You have been unsubscribed.',
      email: 'jane@example.com',
      showManageLink: true,
      showUndoLink: true,
      token: 'tok_abc'
    })
    expect(html).toMatchSnapshot()
  })

  it('snapshot — error', () => {
    const html = renderUnsubscribePage({
      success: false,
      title: 'Invalid Link',
      message: 'The link is expired.',
      showManageLink: true
    })
    expect(html).toMatchSnapshot()
  })
})

// ============================================================================
// Security — autoEscape
// ============================================================================

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
      success: true,
      title: '<script>alert("xss")</script>',
      message: 'test'
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in unsubscribe page message', () => {
    const html = renderUnsubscribePage({
      success: true,
      title: 'Test',
      message: '<img src=x onerror=alert(1)>'
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('escapes HTML in digest sender names', () => {
    const html = renderDigestEmail({
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

// ============================================================================
// Utility functions
// ============================================================================

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

// ============================================================================
// Design token integration
// ============================================================================

describe('design tokens', () => {
  it('uses FONT_STACK from tokens in base layout', () => {
    const html = renderNotificationEmail(NOTIFICATION_PARAMS)
    expect(html).toContain('BlinkMacSystemFont')
    expect(html).toContain("'Segoe UI'") // raw output via <%~ %> for trusted token
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
