/// <reference types="cypress" />

// Read-only handling (B1): showOnlyWhenEditable hides the placeholder in read-only,
// and a runtime setEditable() toggle refreshes it immediately.

describe('placeholder — editable toggle', () => {
  it('hides the placeholder when mounted read-only (showOnlyWhenEditable default)', () => {
    cy.visitPlayground('?editable=false')
    cy.get('#editor [data-placeholder]').should('not.exist')
    cy.get('#editor .is-empty').should('not.exist')
  })

  it('shows the placeholder in read-only when showOnlyWhenEditable is false', () => {
    cy.visitPlayground('?editable=false&showOnlyWhenEditable=false')
    cy.get('#editor [data-placeholder]').should('exist')
  })

  it('B1: setEditable(false) hides and setEditable(true) restores the placeholder at runtime', () => {
    cy.visitPlayground()
    cy.get('#editor [data-placeholder]').should('exist')
    cy.getEditor().then((e) => e.setEditable(false))
    cy.get('#editor [data-placeholder]').should('not.exist')
    cy.getEditor().then((e) => e.setEditable(true))
    cy.get('#editor [data-placeholder]').should('exist')
  })
})

export {}
