/// <reference types="cypress" />

// Multiline indent/outdent: the `\n`-block-separator position math and the
// all-or-nothing context gate, via real cross-paragraph selections on dist.

describe('multiline indent', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('indents every selected line with the 2-space default', () => {
    cy.setEditorContent('<p>AA</p><p>BB</p>')
    cy.selectAcross('AA', 'BB')
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  AA\n\n  BB'))
  })

  it('outdents only the lines that start with an indent', () => {
    cy.setEditorContent('<p>AA</p><p>BB</p>')
    cy.setCaretInText('AA', 0)
    cy.pressKey('Tab') // indent AA only
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  AA\n\nBB'))
    cy.selectAcross('AA', 'BB')
    cy.pressKey('Tab', { shift: true })
    cy.getEditor().should((e) => expect(e.getText()).to.equal('AA\n\nBB'))
  })

  it('rejects the whole op when the selection spans a disallowed context', () => {
    cy.setEditorContent('<h2>H</h2><p>P</p>')
    cy.selectAcross('H', 'P')
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('H\n\nP'))
  })

  it('one undo after a multiline indent restores the text byte-for-byte', () => {
    cy.setEditorContent('<p>AA</p><p>BB</p>')
    cy.selectAcross('AA', 'BB')
    cy.wait(600) // exceed prosemirror-history's newGroupDelay so undo skips setContent
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  AA\n\n  BB'))
    // undo comes from StarterKit's UndoRedo; its Commands augmentation isn't loaded here.
    cy.getEditor().then((e) => (e.commands as unknown as { undo: () => boolean }).undo())
    cy.getEditor().should((e) => expect(e.getText()).to.equal('AA\n\nBB'))
  })
})

export {}
