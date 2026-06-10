/// <reference types="cypress" />

// Real key events (beforeinput pipeline): typed text removes the placeholder,
// and it returns only when the last character is deleted.

describe('placeholder — backspace restore', () => {
  it('returns after real Backspaces delete the typed text', () => {
    cy.visitPlayground()
    cy.get('#editor [contenteditable="true"]').click()
    cy.get('#editor [contenteditable="true"]').realType('ab')
    cy.get('#editor .is-empty').should('not.exist')
    cy.realPress('Backspace')
    cy.get('#editor .is-empty').should('not.exist')
    cy.realPress('Backspace')
    cy.get('#editor .is-empty.is-editor-empty').should('exist')
    cy.get('#editor [data-placeholder]').should('exist')
  })
})

export {}
