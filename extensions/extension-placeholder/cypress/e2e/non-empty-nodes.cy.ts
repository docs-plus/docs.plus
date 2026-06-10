/// <reference types="cypress" />

// Emptiness semantics (isNodeEmpty, ignoreWhitespace=false): a single space and a
// hard break are NOT empty; an empty heading is.

describe('placeholder — non-empty nodes', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('does not show on a paragraph containing only a space', () => {
    cy.getEditor().then((e) => e.chain().focus().insertContent(' ').run())
    cy.get('#editor .is-empty').should('not.exist')
  })

  it('does not show after a hard break', () => {
    cy.getEditor().then((e) => e.chain().focus().setHardBreak().run())
    cy.get('#editor .is-empty').should('not.exist')
  })

  it('shows on an empty heading', () => {
    cy.setEditorContent('<h1></h1>')
    cy.caretInEmptyTextblock()
    cy.get('#editor h1[data-placeholder]').should('exist')
  })
})

export {}
