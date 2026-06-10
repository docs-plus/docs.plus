/// <reference types="cypress" />

// Enter inside a code span must split into two clean code spans — no
// zero-width space and no stray empty mark between them.

describe('inline code — Enter inside a code span', () => {
  it('splits a code span into two code paragraphs with no zero-width space', () => {
    cy.visitPlayground()
    cy.setEditorContent('<p><code>code</code></p>')
    cy.setCaretAfter('co') // caret mid-span
    cy.pressKey('Enter')
    cy.get('#editor code').should('have.length', 2)
    cy.get('#editor code').eq(0).should('have.text', 'co')
    cy.get('#editor code').eq(1).should('have.text', 'de')
    cy.getEditor().should((e) => {
      expect(e.getText()).to.equal('co\n\nde')
      expect(e.getText()).to.not.contain('\u200b')
    })
  })
})

export {}
