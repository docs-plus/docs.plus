/// <reference types="cypress" />

// The mark carries its own markdown hooks; without them a host loading
// @tiptap/markdown serializes the text with no backticks and the span degrades
// to prose. `?markdown=on` loads the extension for these specs only.

describe('inline code — markdown round-trip', () => {
  beforeEach(() => {
    cy.visitPlayground('?markdown=on')
  })

  it('exports a code span with backticks', () => {
    cy.setEditorContent('<p>Call <code>render()</code> first.</p>')
    cy.getMarkdown().should('include', '`render()`')
  })

  it('imports a markdown code span as inlineCode', () => {
    cy.setMarkdown('Call `render()` first.')
    cy.get('#editor code').should('contain.text', 'render()')
    // Proves parseMarkdown applies this package's mark name, not upstream's.
    cy.selectText('render()')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
  })

  it('re-imports exported markdown unchanged', () => {
    cy.setMarkdown('Call `render()` first.')
    cy.getMarkdown().then((exported) => {
      expect(exported).to.include('`render()`')
      cy.setMarkdown(exported)
      cy.get('#editor code').should('contain.text', 'render()')
    })
  })

  it('exports a code span that starts the paragraph', () => {
    cy.setEditorContent('<p><code>code()</code> then text</p>')
    cy.getMarkdown().should('include', '`code()`')
  })
})

export {}
