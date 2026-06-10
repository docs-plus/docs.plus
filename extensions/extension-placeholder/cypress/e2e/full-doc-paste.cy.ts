/// <reference types="cypress" />

// Full-document paste shape: pasted HTML replaces the empty doc (placeholder
// leaves), select-all + delete empties it again (placeholder returns).

describe('placeholder — full-document paste', () => {
  it('clears on pasted HTML and returns after select-all delete', () => {
    cy.visitPlayground()
    cy.getEditor().then((e) => e.commands.focus())
    cy.pasteHTML('<h1>title</h1><p>body</p>')
    cy.get('#editor h1').should('contain.text', 'title')
    cy.get('#editor [data-placeholder]').should('not.exist')
    cy.get('#editor .is-empty').should('not.exist')
    cy.getEditor().then((e) => e.chain().focus().selectAll().deleteSelection().run())
    cy.get('#editor .is-empty.is-editor-empty').should('exist')
    cy.get('#editor [data-placeholder]').should('exist')
  })
})

export {}
