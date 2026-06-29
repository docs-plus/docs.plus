describe('X oEmbed fallback and href allowlist', () => {
  beforeEach(() => {
    cy.visitPlayground('blockquote=off')
    cy.setEditorContent('<p></p>')
  })

  it('seeds a blockquote when oEmbed fails so widgets.js can hydrate', () => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 502,
      body: { error: 'upstream' }
    }).as('xOembedFail')

    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembedFail')
    cy.get('#editor blockquote.twitter-tweet a[href="https://x.com/jack/status/20"]').should(
      'exist'
    )
    cy.nodeCount('x').should('eq', 1)
  })

  it('strips non-X hrefs from oEmbed HTML before innerHTML', () => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 200,
      body: {
        html: [
          '<blockquote class="twitter-tweet">',
          '<a href="https://evil.example/phish">bad</a>',
          '<a href="https://x.com/jack/status/20">good</a>',
          '</blockquote>'
        ].join('')
      }
    }).as('xOembed')

    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembed')
    cy.get('#editor a[href*="evil.example"]').should('not.exist')
    cy.get('#editor blockquote.twitter-tweet a[href="https://x.com/jack/status/20"]').should(
      'exist'
    )
  })
})

export {}
