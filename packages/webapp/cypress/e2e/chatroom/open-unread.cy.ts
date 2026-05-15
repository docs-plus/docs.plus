/// <reference types="cypress" />

describe('chatroom open with unread', () => {
  it('lands on the unread separator when first_unread anchor exists', () => {
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
      statusCode: 200,
      body: {
        rows: [
          { id: 'm1', seq: 10, created_at: '2026-05-13T08:00:00Z', content: 'old' },
          { id: 'm2', seq: 20, created_at: '2026-05-13T09:00:00Z', content: 'new' }
        ],
        anchor_seq: 20,
        has_more_before: false,
        has_more_after: false
      }
    }).as('window')
    cy.visit('/c/test-channel')
    cy.get('[data-key^="unread-"]').should('be.visible')
  })
})
