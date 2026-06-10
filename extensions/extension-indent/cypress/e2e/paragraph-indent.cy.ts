/// <reference types="cypress" />

// Core paragraph indent/outdent via real keypresses on the built dist. Jest owns the
// allowedIndentContexts matrix; the webapp Cypress suite owns the '\t' config. Indents
// are created by pressing Tab — setContent with literal spaces would collapse them.

describe('paragraph indent — 2-space default', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('Tab inserts two spaces at the caret', () => {
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  Hi'))
  })

  it('Tab then typing lands after the indent', () => {
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 0)
    cy.pressKey('Tab')
    cy.getEditor().then((e) => e.chain().insertContent('X').run())
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  XHi'))
  })

  it('Tab then Shift-Tab restores the text byte-for-byte', () => {
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  Hi'))
    cy.pressKey('Tab', { shift: true })
    cy.getEditor().should((e) => expect(e.getText()).to.equal('Hi'))
  })

  it('Shift-Tab at the very start of an indented line outdents it', () => {
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 0)
    cy.pressKey('Tab') // '  Hi', caret after the spaces
    cy.getEditor().then((e) => e.chain().focus().setTextSelection(1).run()) // caret to line start
    cy.pressKey('Tab', { shift: true })
    cy.getEditor().should((e) => expect(e.getText()).to.equal('Hi'))
  })

  it('Shift-Tab is a no-op when there is nothing to outdent', () => {
    cy.setEditorContent('<p>Plain</p>')
    cy.setCaretInText('Plain', 0)
    cy.pressKey('Tab', { shift: true })
    cy.getEditor().should((e) => expect(e.getText()).to.equal('Plain'))
  })

  it('inserts nothing when allowedIndentContexts is empty', () => {
    cy.visitPlayground('?contexts=none')
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('Hi'))
  })

  it('Tab in a list item sinks the list (ListItem keymap wins) and inserts no literal spaces', () => {
    cy.setEditorContent('<ul><li><p>One</p></li><li><p>Two</p></li></ul>')
    cy.setCaretInText('Two', 0)
    cy.pressKey('Tab')
    cy.get('#editor ul ul').should('exist')
    cy.getEditor().should((e) => expect(e.getText()).to.not.contain('  '))
  })
})

export {}
