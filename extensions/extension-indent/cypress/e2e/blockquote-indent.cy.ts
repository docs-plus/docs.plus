/// <reference types="cypress" />

// Default-allowlist promises: paragraphs inside a blockquote indent and outdent,
// headings stay untouched.

describe('blockquote and heading contexts', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  // doc.textContent is separator-free; getText() injects '\n\n' for nested blocks.
  it('Tab indents a paragraph inside a blockquote', () => {
    cy.setEditorContent('<blockquote><p>Quote</p></blockquote>')
    cy.setCaretInText('Quote', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('  Quote'))
  })

  it('Shift-Tab outdents the blockquote paragraph back', () => {
    cy.setEditorContent('<blockquote><p>Quote</p></blockquote>')
    cy.setCaretInText('Quote', 0)
    cy.pressKey('Tab')
    cy.pressKey('Tab', { shift: true })
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('Quote'))
  })

  it('Tab with the caret in a heading is a no-op', () => {
    cy.setEditorContent('<h1>Head</h1>')
    cy.setCaretInText('Head', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('Head'))
  })
})

export {}
