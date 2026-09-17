/// <reference types="cypress" />

const user = {
  id: 'user-1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'tester@example.test'
}
const profile = {
  ...user,
  username: 'tester',
  full_name: 'Tester',
  display_name: 'Tester',
  status: 'ONLINE'
}

export const chatroomRows = Array.from({ length: 40 }, (_, i) => ({
  id: i === 19 ? 'msg-deep-link' : `message-${i + 1}`,
  seq: i + 1,
  created_at: new Date(Date.UTC(2026, 4, 13, 9, i)).toISOString(),
  channel_id: 'test-channel',
  user_id: 'user-2',
  user_details: { id: 'user-2', username: 'teammate', fullname: 'Teammate' },
  content: `Message ${i + 1}`,
  type: 'text',
  reply_to_message_id: i === 39 ? 'message-35' : null,
  replied_message_preview: i === 39 ? 'Message 35' : null,
  reactions: {}
}))

export function clearChatroomDrafts() {
  // Visit an inert document on the app origin: about:blank has no explicit origin,
  // and visiting the real chatroom would reopen its database before deletion.
  const resetPath = '/__chatroom_fixture_reset__'
  cy.intercept('GET', resetPath, {
    headers: { 'content-type': 'text/html' },
    body: '<!doctype html><html><body></body></html>'
  })
  cy.visit(resetPath)
  return cy.window().then(
    (win) =>
      new Promise<void>((resolve, reject) => {
        const request = win.indexedDB.deleteDatabase('chatApp')
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () =>
          reject(new Error('The previous chat draft database is still open'))
      })
  )
}

export function stubChatroom() {
  // Cypress clears cookies/localStorage between cases, but IndexedDB drafts persist.
  clearChatroomDrafts()
  // Virtuoso measures items synchronously; these browser notifications are benign.
  // https://virtuoso.dev/message-list/resize-observer-errors/
  cy.on('uncaught:exception', (error) => {
    if (
      error.message.includes('ResizeObserver loop completed with undelivered notifications.') ||
      error.message.includes('ResizeObserver loop limit exceeded')
    ) {
      return false
    }
  })
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const expires = Math.floor(Date.now() / 1000) + 3600
  const session = {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expires, aud: 'authenticated', role: 'authenticated' })}.test-signature`,
    refresh_token: 'test-refresh-token',
    expires_at: expires,
    expires_in: 3600,
    token_type: 'bearer',
    user
  }
  const base = new URL(Cypress.config('baseUrl')!)
  cy.setCookie('sb-localhost-auth-token', `base64-${encode(session)}`, { domain: base.hostname })
  cy.intercept('GET', '**/auth/v1/user*', { body: user })
  cy.intercept('POST', '**/auth/v1/token*', { body: session })
  cy.intercept({ method: /GET|PATCH/, url: '**/rest/v1/users*' }, { body: profile })
  cy.intercept('POST', '**/rest/v1/rpc/get_channel_aggregate_data*', {
    body: {
      channel_info: {
        id: 'test-channel',
        type: 'PUBLIC',
        name: 'test-channel',
        slug: 'test-channel'
      },
      is_user_channel_member: true,
      is_user_channel_owner: true,
      is_user_channel_admin: true,
      channel_member_info: { member_id: user.id, channel_id: 'test-channel', last_read_seq: 0 },
      pinned_messages: [],
      peer_max_read_seq: null,
      last_read_seq: 0,
      last_messages: [],
      has_more_older: false,
      has_more_newer: false
    }
  })
  cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', (req) => {
    const before = req.body.p_anchor_kind === 'before_seq'
    req.reply({
      body: {
        rows: before ? [] : chatroomRows,
        anchor_seq: req.body.p_anchor_kind === 'message_id' ? 20 : null,
        has_more_before: !before,
        has_more_after: req.body.p_anchor_kind === 'message_id'
      }
    })
  })
  cy.intercept('POST', '**/rest/v1/rpc/get_channel_notif_state*', {
    body: JSON.stringify('ALL'),
    headers: { 'content-type': 'application/json' }
  })
  cy.intercept('POST', '**/rest/v1/rpc/fetch_messages_since*', { body: [] })
  cy.intercept('POST', '**/rest/v1/rpc/advance_read_cursor*', { body: null })
  cy.intercept('POST', '**/rest/v1/messages*', (req) => {
    req.reply({ statusCode: 201, body: [{ ...req.body, seq: 41 }] })
  })
}
