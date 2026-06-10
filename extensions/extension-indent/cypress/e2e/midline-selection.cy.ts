/// <reference types="cypress" />

// Mid-line and select-all selections: indent must prefix line STARTS (never split a
// word at the selection edge), and select-all (AllSelection) must indent eligible blocks.

describe('mid-line and full-document selections', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('indents both paragraphs at line start when the selection begins mid-word', () => {
    cy.setEditorContent('<p>hello</p><p>world</p>')
    cy.getEditor().then((e) => {
      let helloStart: number | undefined
      let worldEnd: number | undefined
      e.state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return
        if (node.textContent === 'hello') helloStart = pos + 1
        if (node.textContent === 'world') worldEnd = pos + 1 + node.content.size
      })
      e.chain()
        .focus()
        .setTextSelection({ from: helloStart! + 2, to: worldEnd! }) // from sits inside 'he|llo'
        .run()
    })
    cy.pressKey('Tab')
    cy.getEditor().should((e) => {
      expect(e.getText()).to.equal('  hello\n\n  world')
      expect(e.getText()).to.not.contain('he  llo')
    })
  })

  it('select-all then Tab indents every eligible paragraph', () => {
    cy.setEditorContent('<p>hello</p><p>world</p>')
    cy.getEditor().then((e) => e.chain().focus().selectAll().run())
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.equal('  hello\n\n  world'))
  })
})

export {}
