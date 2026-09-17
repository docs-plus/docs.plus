/// <reference types="cypress" />

import { stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom deep link', () => {
  it('mounts with the target message visible and flashed', () => {
    const targetId = 'msg-deep-link'
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
      statusCode: 200,
      body: {
        rows: [{ id: targetId, seq: 7, created_at: '2026-05-13T09:00:00Z', content: 'target' }],
        anchor_seq: 7,
        has_more_before: false,
        has_more_after: true
      }
    }).as('window')
    cy.visit(`/c/test-channel?msg=${targetId}`)
    cy.wait('@window')
      .its('request.body')
      .should('include', { p_anchor_kind: 'message_id', p_anchor_value: targetId })
    cy.waitForMessage(targetId)
    cy.waitForMessage(targetId).should('have.class', 'msg_card--flash')
  })
})
