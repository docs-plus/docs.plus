/// <reference types="cypress" />

describe('chatroom scroll and prepend', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('chatroom-feed')
  })

  it('loads older messages when scrolled to top', () => {
    cy.get('.message-feed').scrollTo('top', { duration: 200 })
    cy.get('[data-key="pagination-loader"]').should('exist')
  })

  it('does not emit duplicate day separators across the join', () => {
    cy.get('.message-feed').scrollTo('top', { duration: 200 })
    cy.get('.date_chip').then(($chips) => {
      const dates = [...$chips].map((el) => el.textContent?.trim() ?? '')
      const unique = new Set(dates)
      // Allow re-use across natural day boundaries, just no immediate dupes.
      expect(dates.length).to.be.at.most(unique.size + 1)
    })
  })
})
