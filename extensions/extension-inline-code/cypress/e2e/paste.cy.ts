/// <reference types="cypress" />

// Paste paths: the markPasteRule converts backtick text; bare <code> HTML becomes
// inline code; code-block <pre><code> is NOT converted to inline code.

describe('inline code — paste', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
    cy.getEditor().then((e) => e.chain().focus('end').run())
  })

  it('the paste rule converts a backtick string and keeps the leading char', () => {
    cy.pasteData('text/plain', 'a `b` c')
    cy.get('#editor code').should('have.text', 'b')
    cy.getEditor().should((e) => expect(e.getText()).to.contain('a b c'))
  })

  it('pastes bare <code> HTML as inline code', () => {
    cy.pasteData('text/html', '<p><code>x</code></p>')
    cy.get('#editor code').should('have.text', 'x')
  })

  it('does not convert code-block <pre><code> into inline code', () => {
    cy.pasteData('text/html', '<pre><code>y</code></pre>')
    cy.get('#editor p code').should('not.exist')
  })
})

export {}
