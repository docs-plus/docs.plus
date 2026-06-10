/// <reference types="cypress" />

// Selection-preserving doc edits (collab-shaped transactions): docChanged without
// selectionSet must rebuild, so the decoration survives and follows position shifts.

describe('placeholder — external edits', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p><p>tail</p>')
    cy.caretInBlock(0)
    cy.get('#editor p').eq(0).should('have.attr', 'data-placeholder')
  })

  it('keeps the placeholder on the empty block when text is inserted elsewhere', () => {
    cy.getEditor().then((editor) => {
      // Append inside the trailing paragraph without touching the selection.
      const end = editor.state.doc.content.size - 1
      editor.view.dispatch(editor.state.tr.insertText('!', end))
    })
    cy.get('#editor p').eq(1).should('contain.text', 'tail!')
    cy.get('#editor p').eq(0).should('have.attr', 'data-placeholder')
    cy.get('#editor p').eq(0).should('have.class', 'is-empty')
  })

  it('follows the empty block when a paragraph is inserted before it', () => {
    cy.getEditor().then((editor) => {
      const paragraph = editor.schema.nodes.paragraph.create(null, editor.schema.text('lead'))
      editor.view.dispatch(editor.state.tr.insert(0, paragraph))
    })
    cy.get('#editor p').should('have.length', 3)
    cy.get('#editor p').eq(0).should('not.have.attr', 'data-placeholder')
    cy.get('#editor p').eq(1).should('have.attr', 'data-placeholder')
    cy.get('#editor p').eq(1).should('have.class', 'is-empty')
  })
})

export {}
