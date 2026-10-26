/// <reference types="cypress" />

import { chatroomRows, holdMessageTouch, stubChatroom } from '../../support/chatroomFixtures'

// Messages 39 and 40 put style and onerror on tags in ALLOWED_TAGS
// (src/utils/sanitizeContent.ts), so a looser ALLOWED_ATTR fails this spec.
// Message 38 pins the DOMPurify URI check on href. Message 37 uses tags outside
// ALLOWED_TAGS; it pins the tag allowlist.
const hostileHtml: Record<string, string> = {
  'message-37':
    '<p>blockedTags</p><svg onload="window.__xss=1"><rect width="1" height="1"></rect></svg>' +
    '<iframe src="javascript:window.__xss=1"></iframe><style>p{color:red}</style>',
  'message-38': '<p><a href="javascript:window.__xss=1">scriptLink</a></p>',
  'message-39': '<p><strong style="background:url(javascript:window.__xss=1)">styled</strong></p>',
  'message-40':
    '<p><span onerror="window.__xss=1">onerrorSpan</span> ' +
    '<span data-type="mention" data-id="user-3" data-label="mate">@mate</span></p>'
}

// A legacy row has no `html`, so its `content` takes the escape and linkify path.
const legacyRowId = 'message-36'
const legacyContent = '<img src=x onerror=window.__xss=1>'

const hostileRows = chatroomRows.map((row) => {
  if (row.id === legacyRowId) return { ...row, content: legacyContent }
  const html = hostileHtml[row.id]
  return html ? { ...row, html } : row
})

const blockedSelectors = [
  '[onerror]',
  '[onload]',
  '[style]',
  'svg',
  'iframe',
  'style',
  'a[href^="javascript:"]'
]

const assertNothingSurvives = (scope: string) => {
  for (const selector of blockedSelectors) {
    cy.get(`${scope} ${selector}`).should('not.exist')
  }
  // DOMPurify keeps data-* by default (ALLOW_DATA_ATTR); mentions depend on it.
  cy.get(`${scope} [data-id="user-3"]`).should('exist')
}

const assertNoScriptRan = () =>
  cy.window().then((win) => {
    expect((win as Window & { __xss?: unknown }).__xss).to.equal(undefined)
  })

const messageBody = (id: string) => cy.get(`[data-msg-id="${id}"] .message--card__content`)

beforeEach(stubChatroom)

beforeEach(() => {
  // Registered after stubChatroom, so this window reply wins.
  cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
    body: { rows: hostileRows, anchor_seq: null, has_more_before: false, has_more_after: false }
  })
})

describe('chatroom hostile message HTML', () => {
  it('strips hostile stored HTML from the feed', () => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('message-40')
    // Each hostile row must render, or the absence checks below prove nothing.
    messageBody(legacyRowId).should('contain.text', legacyContent).find('img').should('not.exist')
    messageBody('message-37').should('contain.text', 'blockedTags')
    messageBody('message-38').should('contain.text', 'scriptLink')
    messageBody('message-39').should('contain.text', 'styled')
    messageBody('message-40').should('contain.text', 'onerrorSpan').and('contain.text', '@mate')

    assertNothingSurvives('.message--card__content')
    assertNoScriptRan()
  })

  it('strips hostile stored HTML from the long-press clone card', () => {
    cy.viewport('iphone-x')
    cy.visit('/c/test-channel?variant=mobile')
    cy.waitForMessage('message-40')
    holdMessageTouch('message-40')
    cy.get('[role="toolbar"][aria-label="Quick reactions"]').should('be.visible')

    // The clone's own bubble carries inline style, so check only the cloned body.
    const cloneBody = '.clone-card .message--card__content'
    cy.get(cloneBody).should('contain.text', 'onerrorSpan').and('contain.text', '@mate')
    assertNothingSurvives(cloneBody)
    assertNoScriptRan()
  })
})
