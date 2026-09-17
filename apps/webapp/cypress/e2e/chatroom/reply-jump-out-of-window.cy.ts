/// <reference types="cypress" />

import { chatroomRows, stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom reply jump out-of-window', () => {
  it('fetches the off-window reply target and flashes it', () => {
    const target = { ...chatroomRows[0], id: 'msg-off-window', content: 'Earlier reply target' }
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', (req) => {
      const jumping = req.body.p_anchor_kind === 'message_id'
      if (jumping) req.alias = 'targetWindow'
      req.reply({
        body: {
          rows: jumping
            ? [target]
            : chatroomRows.map((row, index) =>
                index === 39
                  ? {
                      ...row,
                      reply_to_message_id: target.id,
                      replied_message_preview: target.content
                    }
                  : row
              ),
          anchor_seq: jumping ? target.seq : null,
          has_more_before: false,
          has_more_after: jumping
        }
      })
    })
    cy.visit('/c/test-channel')
    cy.get(`[data-key="reply-ref-${target.id}"]`).click()
    cy.wait('@targetWindow').its('request.body.p_anchor_value').should('equal', target.id)
    cy.waitForMessage(target.id).should('have.class', 'msg_card--flash')
  })
})
