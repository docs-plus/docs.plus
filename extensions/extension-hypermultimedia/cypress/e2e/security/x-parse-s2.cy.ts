describe('X parseHTML href gate (S2)', () => {
  beforeEach(() => {
    // StarterKit's blockquote is disabled via fixture param so X's
    // `blockquote.twitter-tweet` parse rule is the one that runs.
    cy.visitPlayground('blockquote=off')
  })

  it('parses a valid status blockquote into an x node with a normalized src', () => {
    cy.setEditorContent(
      '<blockquote class="twitter-tweet"><a href="https://x.com/docsdotplus/status/1234567890">tweet</a></blockquote>'
    )
    cy.nodeCount('x').should('eq', 1)
    cy.nodeAttr('x', 'src').should('eq', 'https://x.com/docsdotplus/status/1234567890')
  })

  it('drops javascript: href from blockquote.twitter-tweet on setContent', () => {
    cy.setEditorContent(
      '<blockquote class="twitter-tweet"><a href="javascript:alert(1)">tweet</a></blockquote>'
    )
    // Hostile href ⇒ getAttrs returns false ⇒ no junk x node, no executable href in the DOM.
    cy.nodeCount('x').should('eq', 0)
    cy.get('#editor blockquote.twitter-tweet a').should('not.exist')
    cy.get('#editor a[href^="javascript:"]').should('not.exist')
  })
})

export {}
