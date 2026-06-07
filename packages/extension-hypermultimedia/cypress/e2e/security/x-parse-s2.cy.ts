describe('X parseHTML href gate (S2)', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  // StarterKit blockquote claims `blockquote.twitter-tweet` in the clean-room harness;
  // S2 is covered indirectly via setX + oEmbed sanitization (x-oembed-s3).
  it.skip('drops javascript: href from blockquote.twitter-tweet on setContent', () => {
    cy.setEditorContent(
      '<blockquote class="twitter-tweet"><a href="javascript:alert(1)">tweet</a></blockquote>'
    )
    cy.nodeCount('x').should('eq', 1)
    cy.getEditor().then((editor) => {
      let src: string | null = null
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'x') src = node.attrs.src
      })
      expect(src).to.be.null
    })
    cy.get('#editor blockquote.twitter-tweet a').should(
      'not.have.attr',
      'href',
      'javascript:alert(1)'
    )
  })
})

export {}
