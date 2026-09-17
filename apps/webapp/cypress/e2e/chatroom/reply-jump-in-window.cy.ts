/// <reference types="cypress" />

import { stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom reply jump in-window', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('chatroom-feed')
  })

  it('smooth-scrolls and flashes the target on reply-ref tap', () => {
    cy.get('[data-key="reply-ref-message-35"]').click()
    cy.waitForMessage('message-35').should('have.class', 'msg_card--flash')
  })
})
