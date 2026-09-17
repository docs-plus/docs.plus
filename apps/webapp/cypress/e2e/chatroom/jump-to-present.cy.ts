/// <reference types="cypress" />

import { stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom jump to present', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel?msg=msg-deep-link')
    cy.waitForMessage('chatroom-feed')
  })

  it('shows the floating button while detached and returns to live tail on tap', () => {
    cy.get('[data-key="jump-to-present"]').should('be.visible')
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*').as('presentWindow')
    cy.get('[data-key="jump-to-present"]').click()
    cy.wait('@presentWindow').its('request.body.p_anchor_kind').should('equal', 'tail')
    cy.waitForMessage('message-40')
    cy.get('[data-key="jump-to-present"]').should('not.exist')
  })
})
