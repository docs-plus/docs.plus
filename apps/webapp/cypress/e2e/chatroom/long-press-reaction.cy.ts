/// <reference types="cypress" />

import { stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom long-press reaction', () => {
  it('opens quick reactions on a held touch and submits the chosen emoji', () => {
    cy.viewport('iphone-x')
    cy.intercept('POST', '**/rest/v1/rpc/add_reaction*', {
      statusCode: 200,
      body: { '👍': [{ user_id: 'user-1', created_at: '2026-05-13T10:00:00Z' }] }
    }).as('addReaction')
    cy.visit('/c/test-channel?variant=mobile')
    cy.waitForMessage('message-40')
    // realTouch sends touchEnd immediately; keep this touch down past the 500ms threshold.
    cy.get('[data-msg-id="message-40"] .chat-bubble').trigger('touchstart', {
      touches: [{ identifier: 1, clientX: 150, clientY: 400 }],
      changedTouches: [{ identifier: 1, clientX: 150, clientY: 400 }]
    })
    cy.get('[role="toolbar"][aria-label="Quick reactions"]').should('be.visible')
    cy.get('[data-msg-id="message-40"][data-mode="inline"] .chat-bubble').trigger('touchend', {
      touches: [],
      changedTouches: [{ identifier: 1, clientX: 150, clientY: 400 }],
      force: true
    })
    cy.get('[aria-label="React with Like"]').should('be.enabled').realClick()
    cy.wait('@addReaction').its('request.body').should('deep.equal', {
      p_message_id: 'message-40',
      p_emoji: '👍'
    })
    cy.get('[role="toolbar"][aria-label="Quick reactions"]').should('not.exist')
  })
})
