describe('X oEmbed sanitization (S3/S4)', () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://publish.twitter.com/oembed*', {
      statusCode: 200,
      body: {
        html: [
          '<blockquote class="twitter-tweet">',
          '<script>window.__xss = 1</script>',
          '<img src="x" onerror="window.__xss = 2">',
          '<a href="//evil.example/phish">bad</a>',
          '</blockquote>'
        ].join('')
      }
    }).as('xOembed')
    cy.visitPlayground()
  })

  it('scrubs hostile oEmbed HTML before innerHTML', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembed')
    cy.get('#editor .hypermultimedia--x__content', { timeout: 8000 }).should('exist')
    cy.get('#editor script').should('not.exist')
    cy.get('#editor img[onerror]').should('not.exist')
    cy.get('#editor a[href^="//"]').should('not.exist')
    cy.window().then((win) => {
      expect((win as Window & { __xss?: number }).__xss).to.be.undefined
    })
  })
})

export {}
