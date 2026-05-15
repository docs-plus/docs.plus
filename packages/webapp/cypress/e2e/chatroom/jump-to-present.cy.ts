/// <reference types="cypress" />

describe('chatroom jump to present', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel?msg=msg-deep-link')
    cy.waitForMessage('chatroom-feed')
  })

  it('shows the floating button while detached and returns to live tail on tap', () => {
    cy.get('[data-key="jump-to-present"]').should('be.visible')
    cy.get('[data-key="jump-count"]').should('exist')
    cy.get('[data-key="jump-to-present"]').click()
    cy.get('[data-key="jump-to-present"]').should('not.exist')
  })
})
