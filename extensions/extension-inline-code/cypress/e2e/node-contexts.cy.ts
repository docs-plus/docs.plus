/// <reference types="cypress" />

// The backtick rule must respect the surrounding node: code blocks suppress
// every input rule (their NodeSpec is `code`), while headings allow marks.

describe('inline code — node contexts', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('the backtick rule stays literal inside a code block', () => {
    cy.setEditorContent('<pre><code>text</code></pre>')
    cy.setCaretAfter('text') // caret inside the code block
    cy.typeInEditor('`x`')
    cy.get('#editor pre code').should('have.text', 'text`x`')
    cy.getEditor().should((e) => {
      expect(JSON.stringify(e.getJSON())).to.not.contain('inlineCode')
    })
  })

  it('the backtick rule fires inside a heading', () => {
    cy.setEditorContent('<h2>title</h2>')
    cy.setCaretAfter('title')
    cy.typeInEditor(' `x`')
    cy.get('#editor h2 code').should('have.text', 'x')
  })
})

export {}
