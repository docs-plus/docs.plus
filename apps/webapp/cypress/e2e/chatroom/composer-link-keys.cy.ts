/// <reference types="cypress" />

import type { Editor } from '@tiptap/core'

import { stubChatroom } from '../../support/chatroomFixtures'

beforeEach(stubChatroom)

describe('composer Alt+Enter', () => {
  beforeEach(() => {
    cy.visit('/c/test-channel', {
      onBeforeLoad(win) {
        cy.stub(win, 'open').as('windowOpen')
      }
    })
    cy.waitForMessage('message-40')
  })

  it('opens the link around the caret and sends nothing', () => {
    let sends = 0
    cy.intercept('POST', '**/rest/v1/messages*', (req) => {
      sends += 1
      req.reply({ statusCode: 201, body: [] })
    })
    // The space after the URL runs autolink. Two steps left put the caret strictly inside it.
    cy.get('[data-testid="composer-input"] .ProseMirror').type('https://example.com ')
    cy.get('[data-testid="composer-input"] a[href="https://example.com"]').should('exist')
    cy.get('[data-testid="composer-input"] .ProseMirror').type('{leftArrow}{leftArrow}')
    // ProseMirror reads a caret move on `selectionchange`, so wait until the editor has it.
    cy.get('[data-testid="composer-input"] .ProseMirror').should(($el) => {
      const { $from } = ($el[0] as unknown as { editor: Editor }).editor.state.selection
      const isLink = (node: typeof $from.nodeAfter) =>
        !!node?.marks.some((mark) => mark.type.name === 'hyperlink')
      expect(isLink($from.nodeBefore), 'link before the caret').to.equal(true)
      expect(isLink($from.nodeAfter), 'link after the caret').to.equal(true)
    })
    cy.get('[data-testid="composer-input"] .ProseMirror').type('{alt}{enter}')
    cy.get('@windowOpen').should('have.been.calledWith', 'https://example.com', '_blank')
    cy.get('[data-testid="composer-input"]').should('contain.text', 'https://example.com')
    cy.then(() => expect(sends, 'message sends').to.equal(0))
  })

  it('still sends when the caret is not in a link', () => {
    cy.intercept('POST', '**/rest/v1/messages*').as('send')
    cy.get('[data-testid="composer-input"] .ProseMirror').type('plain words{alt}{enter}')
    cy.wait('@send').its('request.body.content').should('equal', 'plain words')
    cy.get('@windowOpen').should('not.have.been.called')
  })
})
