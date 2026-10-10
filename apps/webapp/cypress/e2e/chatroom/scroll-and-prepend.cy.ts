/// <reference types="cypress" />

import { chatroomRows, stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom scroll and prepend', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', (req) => {
      const older = req.body.p_anchor_kind === 'before_seq'
      if (older) req.alias = 'olderWindow'
      req.reply({
        delay: older ? 300 : 0,
        body: {
          rows: older
            ? [{ ...chatroomRows[0], id: 'older-message', seq: 0, content: 'Earlier message' }]
            : chatroomRows,
          anchor_seq: null,
          has_more_before: !older,
          has_more_after: false
        }
      })
    })
    cy.visit('/c/test-channel')
    cy.waitForMessage('message-40')
    cy.get('[data-testid="virtuoso-scroller"]').scrollTo('top', { duration: 200 })
    cy.get('[data-key="pagination-loader"]').should('be.visible')
    cy.wait('@olderWindow').its('request.body.p_anchor_value').should('equal', '1')
    cy.get('[data-key="pagination-loader"]').should('not.exist')
    // Virtuoso keeps the old first row in place by moving scrollTop off 0 some frames after
    // the prepend. A scroll sent before that shift lands is overwritten, so wait for the shift.
    cy.get('[data-testid="virtuoso-scroller"]').should(($scroller) => {
      expect($scroller[0].scrollTop).to.be.greaterThan(0)
    })
  })

  it('prepends the older page without losing the loaded page', () => {
    cy.scrollToMessageViaApi('older-message')
    cy.waitForMessage('older-message')
    cy.waitForMessage('message-1')
    cy.get('[data-key="pagination-loader"]').should('not.exist')
  })

  it('keeps exactly one day separator across a same-day page join', () => {
    cy.scrollToMessageViaApi('older-message')
    cy.waitForMessage('older-message')
    cy.get('[data-testid="virtuoso-list"] .date_chip[data-msg-date="2026-05-13"]').should(
      'have.length',
      1
    )
  })
})
