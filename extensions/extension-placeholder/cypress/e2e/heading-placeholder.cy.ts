/// <reference types="cypress" />

// Function placeholder per node type: the fn fixture returns 'Untitled' for
// headings, and is-editor-empty stays off because the document is not empty.

describe('placeholder — heading function placeholder', () => {
  it('shows Untitled on an empty heading without is-editor-empty', () => {
    cy.visitPlayground('?placeholder=fn')
    cy.setEditorContent('<h1></h1><p>body</p>')
    cy.caretInBlock(0)
    cy.get('#editor h1[data-placeholder="Untitled"]').should('have.class', 'is-empty')
    cy.get('#editor .is-editor-empty').should('not.exist')
  })
})

export {}
