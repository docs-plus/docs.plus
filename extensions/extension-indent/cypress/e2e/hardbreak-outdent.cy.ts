/// <reference types="cypress" />

// Outdent measures text but deletes by position: a hardBreak between the indent and
// the caret must never be deleted in place of indent characters.

describe('outdent next to a hard break', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('keeps the hard break and both visual lines when Shift-Tab follows Tab + Shift-Enter', () => {
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 2)
    cy.pressKey('Tab') // 'Hi  ' with the caret after the indent
    cy.pressKey('Enter', { shift: true }) // hard break right after the indent
    cy.pressKey('Tab', { shift: true })
    cy.get('#editor br').should('exist')
    // getText() serializes the hard break as '\n'; the indent must survive untouched.
    cy.getEditor().should((e) => expect(e.getText()).to.equal('Hi  \n'))
  })
})

export {}
