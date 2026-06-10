/// <reference types="cypress" />

// Stored-mark entry: a collapsed-caret toggle seeds the mark for the next typed
// char with NO zero-width space in the document (the old ZWSP insertion is gone).

describe('inline code — stored-mark caret entry', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  it('empty-caret toggle-on then typing produces code with no zero-width space', () => {
    cy.getEditor().then((e) => e.chain().focus('end').toggleInlineCode().run())
    cy.typeInEditor('x')
    cy.get('#editor code').should('have.text', 'x')
    cy.getEditor().should((e) => {
      // getText() === 'x' (not 'x​') already proves no zero-width space leaked.
      expect(e.getText()).to.equal('x')
    })
  })

  it('toggle-on then off without typing leaves a clean, empty document', () => {
    cy.getEditor().then((e) => e.chain().focus('end').toggleInlineCode().run())
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.getEditor().then((e) => e.chain().focus().toggleInlineCode().run())
    cy.getEditor().should((e) => {
      expect(e.isActive('inlineCode')).to.equal(false)
      expect(e.getText()).to.equal('') // no stray zero-width space
    })
  })
})

export {}
