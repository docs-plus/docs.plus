/// <reference types="cypress" />

// Undo/redo round-trip: undo back to the empty doc restores the decoration,
// redo re-applies the content and removes it again.

// Registers the undo/redo command typings from StarterKit's UndoRedo extension.
import '@tiptap/starter-kit'

describe('placeholder — history restore', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('returns on undo back to the empty doc and leaves again on redo', () => {
    cy.getEditor().then((e) => e.chain().focus().insertContent('a').run())
    cy.get('#editor [data-placeholder]').should('not.exist')
    cy.getEditor().then((e) => e.commands.undo())
    cy.get('#editor .is-empty.is-editor-empty').should('exist')
    cy.get('#editor [data-placeholder]').should('exist')
    cy.getEditor().then((e) => e.commands.redo())
    cy.get('#editor .is-empty').should('not.exist')
    cy.get('#editor [data-placeholder]').should('not.exist')
  })
})

export {}
