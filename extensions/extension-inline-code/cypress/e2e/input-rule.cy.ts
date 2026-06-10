/// <reference types="cypress" />

// Backtick input rule — real typing, since programmatic insertContent does not
// fire input rules.

describe('inline code — input rule', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
    cy.getEditor().then((e) => e.chain().focus('end').run())
  })

  it('converts `text` to inline code while typing mid-paragraph', () => {
    cy.typeInEditor('see `code` here')
    cy.get('#editor code').should('have.text', 'code')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('see code here'))
  })

  it('converts `text` typed at the start of a paragraph', () => {
    cy.typeInEditor('`x`')
    cy.get('#editor code').should('have.text', 'x')
  })

  it('does not fire on triple backticks mid-paragraph', () => {
    cy.typeInEditor('a ```x``` b')
    cy.get('#editor code').should('not.exist')
  })

  // `code: true` makes @tiptap/core suppress every extension's input rules
  // next to code-marked text, so bold/typography cannot rewrite code content.
  it('other input rules do not rewrite text typed inside a code span', () => {
    cy.setEditorContent('<p><code>code</code></p>')
    cy.setCaretAfter('co') // caret mid-span
    cy.typeInEditor(' **x**') // leading space would arm StarterKit's bold rule
    cy.get('#editor strong').should('not.exist')
    cy.get('#editor code').should('have.text', 'co **x**de') // literal asterisks kept
  })

  it('Backspace right after the rule restores the literal backticks', () => {
    cy.typeInEditor('`x`')
    cy.get('#editor code').should('have.text', 'x')
    cy.pressKey('Backspace') // undoInputRule reverts only the rule transform
    cy.get('#editor code').should('not.exist')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('`x`'))
  })
})

export {}
