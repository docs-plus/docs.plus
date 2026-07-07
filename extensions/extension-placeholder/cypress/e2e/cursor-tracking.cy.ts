/// <reference types="cypress" />

// O(depth) cursor tracking: the placeholder follows the cursor's empty parent, and
// is-editor-empty is withheld while the document is non-empty.

describe('placeholder — cursor tracking', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>one</p><p></p><p>three</p>')
  })

  it('shows is-empty but not is-editor-empty on a mid-document empty paragraph', () => {
    cy.caretInBlock(1)
    cy.get('#editor [data-placeholder]').should('exist')
    cy.get('#editor .is-empty').should('exist')
    cy.get('#editor .is-editor-empty').should('not.exist')
  })

  it('clears the placeholder when the cursor enters a filled node', () => {
    cy.caretInBlock(1)
    cy.get('#editor .is-empty').should('exist')
    cy.caretInBlock(2)
    cy.get('#editor .is-empty').should('not.exist')
  })
})

export {}
