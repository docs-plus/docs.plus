/// <reference types="cypress" />

import { clearChatroomDrafts, stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('chatroom send and retry', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel')
    cy.waitForMessage('message-40')
  })

  it('clears persisted drafts from the app origin before the next visit', () => {
    cy.get('[data-testid="composer-input"] .ProseMirror').should('be.visible')
    cy.window().then(
      (win) =>
        new Promise<void>((resolve, reject) => {
          const request = win.indexedDB.open('chatApp')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const transaction = db.transaction('composer', 'readwrite')
            transaction.objectStore('composer').put({
              workspaceId: 'e2e-workspace',
              roomId: 'test-channel',
              state: { text: 'Draft left by the previous case' },
              updatedAt: Date.now()
            })
            transaction.oncomplete = () => {
              db.close()
              resolve()
            }
            transaction.onerror = () => {
              db.close()
              reject(transaction.error)
            }
          }
        })
    )
    clearChatroomDrafts()
    cy.window().then(async (win) => {
      expect(win.location.origin).to.equal(new URL(Cypress.config('baseUrl')!).origin)
      const databases = await win.indexedDB.databases()
      expect(databases.map((database) => database.name)).not.to.include('chatApp')
    })
    cy.visit('/c/test-channel')
    cy.waitForMessage('message-40')
    cy.get('[data-testid="composer-input"]').should('have.text', '')
  })

  it('posts a message and renders the optimistic row', () => {
    cy.intercept('POST', '**/rest/v1/messages*').as('send')
    cy.get('[data-testid="composer-input"]').type('hello from cypress')
    cy.get('[data-testid="composer-primary-action"]')
      .should('have.attr', 'aria-label', 'Send message')
      .click()
    cy.wait('@send').its('request.body.content').should('equal', 'hello from cypress')
    cy.contains('.msg_card', 'hello from cypress').should('be.visible')
    cy.get('[data-testid="composer-input"]').should('have.text', '')
  })

  it('retries an RLS failure with the original message id', () => {
    cy.intercept('POST', '**/rest/v1/messages*', {
      statusCode: 401,
      body: { code: '42501' }
    }).as('failedSend')
    cy.get('[data-testid="composer-input"]').type('this will fail')
    cy.get('[data-testid="composer-primary-action"]')
      .should('have.attr', 'aria-label', 'Send message')
      .click()
    cy.wait('@failedSend')
    cy.contains('.msg_card', 'this will fail').within(() => {
      cy.contains('Failed to send').should('be.visible')
      cy.get('[aria-label="Retry sending message"]').should('be.visible')
    })
    cy.get('[data-testid="composer-input"]').should('have.text', '')
    cy.get('@failedSend').then((failed) => {
      const originalId = (failed as unknown as { request: { body: { id: string } } }).request.body
        .id
      cy.intercept('POST', '**/rest/v1/messages*', (req) => {
        expect(req.body.id).to.equal(originalId)
        expect(req.body.content).to.equal('this will fail')
        req.reply({ statusCode: 201, body: [{ ...req.body, seq: 41 }] })
      }).as('retrySend')
    })
    cy.get('[aria-label="Retry sending message"]')
      .should('be.visible')
      .click({ scrollBehavior: false })
    cy.wait('@retrySend')
    cy.contains('.msg_card', 'this will fail')
      .should('be.visible')
      .within(() => {
        cy.contains('Failed to send').should('not.exist')
        cy.get('[aria-label="Sending"]').should('not.exist')
        cy.get('time').should('exist')
      })
  })

  it('treats 23505 duplicate-key as success', () => {
    cy.intercept('POST', '**/rest/v1/messages*', {
      statusCode: 409,
      body: { code: '23505', message: 'duplicate key value violates unique constraint' }
    }).as('dupSend')
    cy.get('[data-testid="composer-input"]').type('idempotent send')
    cy.get('[data-testid="composer-primary-action"]')
      .should('have.attr', 'aria-label', 'Send message')
      .click()
    cy.wait('@dupSend')
    cy.contains('.msg_card', 'idempotent send')
      .should('be.visible')
      .within(() => {
        cy.contains('Failed to send').should('not.exist')
        cy.get('[aria-label="Sending"]').should('not.exist')
        cy.get('time').should('exist')
        cy.get('[aria-label="Retry sending message"]').should('not.exist')
      })
  })
})
