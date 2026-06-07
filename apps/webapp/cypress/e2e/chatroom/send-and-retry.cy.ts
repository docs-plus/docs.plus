/// <reference types="cypress" />

describe('chatroom send and retry', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('chatroom-feed')
  })

  it('sends a message and renders it', () => {
    cy.get('[data-testid="composer-input"]').type('hello from cypress')
    cy.get('[data-testid="composer-submit"]').click()
    cy.contains('hello from cypress').should('be.visible')
  })

  it('shows failed state on RLS error', () => {
    cy.intercept('POST', '**/rest/v1/messages*', {
      statusCode: 401,
      body: { code: '42501' }
    }).as('failedSend')
    cy.get('[data-testid="composer-input"]').type('this will fail')
    cy.get('[data-testid="composer-submit"]').click()
    cy.wait('@failedSend')
    cy.get('[data-status="failed"]').should('be.visible')
  })

  it('treats 23505 duplicate-key as success', () => {
    cy.intercept('POST', '**/rest/v1/messages*', {
      statusCode: 409,
      body: { code: '23505', message: 'duplicate key value violates unique constraint' }
    }).as('dupSend')
    cy.get('[data-testid="composer-input"]').type('idempotent send')
    cy.get('[data-testid="composer-submit"]').click()
    cy.wait('@dupSend')
    cy.get('[data-status="sent"]').should('exist')
  })
})
