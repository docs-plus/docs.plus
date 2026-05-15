/// <reference types="cypress" />

describe('chatroom reply jump in-window', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('chatroom-feed')
  })

  it('smooth-scrolls and flashes the target on reply-ref tap', () => {
    cy.get('[data-key^="reply-ref-"]').first().click()
    cy.get('.msg_card--flash').should('be.visible')
  })
})
