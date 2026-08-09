/// <reference types="cypress" />

// Multiline indent/outdent: line resolution, the all-or-nothing context gate,
// and the boundary-touch rule, via real cross-paragraph selections on dist.

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

  // Shift-Down from the last line of a block parks the selection head on the
  // next block's first position. That block is touched but holds no selected
  // character, so it must not join the line set — and must not veto the op.
  it('ignores a block the selection only touches at its first position', () => {
    cy.setEditorContent('<p>AA</p><h2>H</h2>')
    cy.getEditor().then((e) => {
      let headingStart = 0
      e.state.doc.forEach((node, offset) => {
        if (node.type.name === 'heading') headingStart = offset + 1
      })
      e.chain().focus().setTextSelection({ from: 1, to: headingStart }).run()
    })
    cy.pressKey('Tab')
    // StarterKit's trailingNode appends an empty paragraph after the heading.
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  AA\n\nH\n\n'))
  })

  it('does not indent a following paragraph the selection only touches', () => {
    cy.setEditorContent('<p>AA</p><p>BB</p>')
    cy.getEditor().then((e) => {
      let second = 0
      e.state.doc.forEach((node, offset, index) => {
        if (index === 1) second = offset + 1
      })
      e.chain().focus().setTextSelection({ from: 1, to: second }).run()
    })
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  AA\n\nBB'))
  })

  it('one undo after a multiline indent restores the text byte-for-byte', () => {
    cy.setEditorContent('<p>AA</p><p>BB</p>')
    cy.selectAcross('AA', 'BB')
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  AA\n\n  BB'))
    // undo comes from StarterKit's UndoRedo; its Commands augmentation isn't loaded here.
    cy.getEditor().then((e) => (e.commands as unknown as { undo: () => boolean }).undo())
    cy.getEditor().should((e) => expect(e.getText()).to.equal('AA\n\nBB'))
  })
})

export {}
