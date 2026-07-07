/// <reference types="cypress" />

// Pins the documented `enabled: false` escape hatch through the keymap on the shipped
// dist: a host that disables the extension must not get literal indent characters from
// Tab, and Shift-Tab must not strip existing leading indent. Jest owns the
// command-level `enabled` gates (indent()/outdent() return false, Tab stays unclaimed).

describe('enabled: false — disabled extension must not touch the document', () => {
  beforeEach(() => {
    cy.visitPlayground('?enabled=off')
  })

  it('Tab in an allowed context inserts no literal spaces', () => {
    cy.setEditorContent('<p>Hi</p>')
    cy.setCaretInText('Hi', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('Hi'))
  })

  it('Shift-Tab strips nothing from an already-indented line', () => {
    // JSON setContent preserves the leading spaces that HTML parsing would collapse.
    cy.getEditor().then((e) =>
      e.commands.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '  Hi' }] }]
      })
    )
    cy.setCaretInText('Hi', 0) // caret right after the two-space indent — the strip position
    cy.pressKey('Tab', { shift: true })
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  Hi'))
  })
})

export {}
