/// <reference types="cypress" />

describe('chatroom long-press reaction', () => {
  beforeEach(() => {
    cy.viewport('iphone-x')
    cy.visit('/c/test-channel')
    cy.waitForMessage('chatroom-feed')
  })

  it('opens the reaction picker on long press and increments the count', () => {
    cy.intercept('POST', '**/rest/v1/rpc/add_reaction*', {
      statusCode: 200,
      body: { reactions: { '👍': 1 } }
    }).as('addReaction')

    cy.get('.msg_card').first().realTouch({ position: 'center' }).wait(600)
    cy.get('[data-key="long-press-menu"]', { timeout: 4000 }).should('be.visible')
    cy.get('[data-key="reaction-picker"]').first().click()
    cy.wait('@addReaction')
    cy.contains('1').should('be.visible')
  })
})
