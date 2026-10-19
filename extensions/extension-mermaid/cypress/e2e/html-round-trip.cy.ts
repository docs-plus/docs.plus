/// <reference types="cypress" />

// Failure mode: the drawn SVG leaks into the document HTML, or the node does not
// survive `getHTML()` then `setContent()`.

const GOOD = 'flowchart LR\n  A[Write] --> B[See it]'

describe('mermaid — HTML round-trip', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('round-trips through getHTML with no SVG', () => {
    cy.setEditorContent('<pre><code class="language-mermaid">' + GOOD + '</code></pre>')
    cy.get('.mermaid-diagram > [data-state]').should('have.attr', 'data-state', 'ready')
    cy.getEditor().then((editor) => {
      const before = editor.getJSON()
      const html = editor.getHTML()
      expect(html).to.not.include('<svg')
      expect(html).to.include('<code class="language-mermaid">')
      // Clear first, so a no-op import cannot pass by leaving the old node in place.
      editor.commands.setContent('<p>reset</p>')
      expect(editor.state.doc.firstChild?.type.name).to.equal('paragraph')
      editor.commands.setContent(html)
      expect(editor.getJSON()).to.deep.equal(before)
    })
  })
})

export {}
