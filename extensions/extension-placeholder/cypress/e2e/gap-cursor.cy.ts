/// <reference types="cypress" />

// Non-text selections: a NodeSelection on <hr> and the adjacent gap cursor sit at
// doc depth, so they must produce no decoration and no uncaught exception.

describe('placeholder — node selection and gap cursor', () => {
  it('stays silent on an hr NodeSelection and the adjacent gap cursor', () => {
    cy.visitPlayground()
    let caught: Error | null = null
    cy.on('uncaught:exception', (err) => {
      caught = err
      return false
    })
    cy.setEditorContent('<hr>')
    cy.getEditor().then((e) => e.chain().focus().setNodeSelection(0).run())
    cy.get('#editor .is-empty').should('not.exist')
    cy.get('#editor [data-placeholder]').should('not.exist')
    cy.get('#editor [contenteditable="true"]').trigger('keydown', {
      key: 'ArrowLeft',
      keyCode: 37,
      bubbles: true
    })
    cy.get('#editor .is-empty').should('not.exist')
    cy.get('#editor [data-placeholder]').should('not.exist')
    cy.then(() => {
      expect(caught, 'no uncaught exception').to.be.null
    })
  })
})

export {}
