describe('transaction-safe hyperlink edits', () => {
  for (const mode of ['command', 'chain'] as const) {
    it(`edits text and URL through the ${mode} entry point without a mismatched transaction`, () => {
      cy.visitPlayground()
      cy.setEditorContent(
        '<p>Before <a href="https://example.com"><strong>Original</strong></a> after.</p>'
      )
      cy.selectText('Original')
      cy.getEditor().then((editor) => {
        const attrs = { newURL: 'https://google.com', newText: 'Testing' }
        if (mode === 'command') editor.commands.editHyperlink(attrs)
        else editor.chain().focus().extendMarkRange('hyperlink').editHyperlink(attrs).run()
      })
      cy.get('#editor a').should('have.attr', 'href', 'https://google.com')
      cy.get('#editor a strong').should('have.text', 'Testing')
      cy.get('#editor p').should('have.text', 'Before Testing after.')
    })
  }
})

export {}
