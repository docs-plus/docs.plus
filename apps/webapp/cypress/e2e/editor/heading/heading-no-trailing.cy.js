/* eslint-disable no-undef */

const text = (value) => [{ type: 'text', text: value }]

describe('No trailing heading (flat schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'heading-no-trailing-test' })
  })

  it('keeps a replace that ends in a paragraph', () => {
    // Same call as Settings → Markdown replace (`applyImportedContent`).
    cy.window().then((win) => {
      win._editor.commands.setContent({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: text('New title') },
          { type: 'heading', attrs: { level: 2 }, content: text('Section') },
          { type: 'paragraph', content: text('Last paragraph') }
        ]
      })
    })

    cy.get('.docy_editor > .tiptap.ProseMirror > :last-child').should(($last) => {
      expect($last.prop('tagName')).to.equal('P')
      expect($last.text()).to.equal('Last paragraph')
    })
  })
})
