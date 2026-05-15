/// <reference types="cypress" />

describe('chatroom reply jump out-of-window', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('chatroom-feed')
  })

  it('replaces data and lands on the off-window target', () => {
    const offWindowId = 'msg-off-window'
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
      statusCode: 200,
      body: {
        rows: [{ id: offWindowId, seq: 42, created_at: '2026-05-13T10:00:00Z', content: 'off' }],
        anchor_seq: 42,
        has_more_before: false,
        has_more_after: true
      }
    }).as('window')
    cy.scrollToMessageViaApi(offWindowId)
    cy.get(`[data-key="${offWindowId}"]`).should('be.visible')
  })
})
