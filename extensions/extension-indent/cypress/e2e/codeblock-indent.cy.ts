/// <reference types="cypress" />

// codeBlock is not an allowed indent context by default, and its embedded \n characters
// must not be treated as block separators by the multiline position math.

describe('code block indent gating', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  // doc.textContent ignores the empty paragraph StarterKit's trailingNode appends
  // after a doc-final code block, so equality pins the block's exact text.
  it('Tab with the caret inside a code block leaves the document unchanged', () => {
    cy.setEditorContent('<pre><code>alpha\nbeta</code></pre>')
    cy.setCaretInText('alpha', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('alpha\nbeta'))
  })

  it('Tab over a selection spanning embedded lines leaves the code block unchanged', () => {
    cy.setEditorContent('<pre><code>alpha\nbeta</code></pre>')
    cy.selectAcross('alpha', 'beta')
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.state.doc.textContent).to.equal('alpha\nbeta'))
  })
})

export {}
