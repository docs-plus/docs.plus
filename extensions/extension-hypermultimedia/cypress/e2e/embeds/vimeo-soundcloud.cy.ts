describe('Vimeo and SoundCloud embed hosts', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('inserts a Vimeo embed with player.vimeo.com src', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setVimeo({ src: 'https://vimeo.com/123456789' })
    })
    cy.get('#editor iframe')
      .should('have.attr', 'src')
      .and('match', /player\.vimeo\.com\/video\/123456789/)
    cy.nodeCount('vimeo').should('eq', 1)
  })

  for (const { label, src, hash } of [
    { label: 'watch URL path', src: 'https://vimeo.com/123456789/deadbeef', hash: 'deadbeef' },
    { label: 'watch URL query', src: 'https://vimeo.com/123456789?h=abc123', hash: 'abc123' },
    {
      label: 'player URL query',
      src: 'https://player.vimeo.com/video/123456789?h=abc123',
      hash: 'abc123'
    },
    {
      label: 'query before path',
      src: 'https://vimeo.com/123456789/deadbeef?h=abc123',
      hash: 'abc123'
    }
  ]) {
    it(`preserves the unlisted Vimeo hash from the ${label} through HTML round-trip`, () => {
      cy.getEditor().then((editor) => {
        editor.commands.setVimeo({ src })
      })
      const checkPlayer = () => {
        cy.get('#editor iframe').should(($iframe) => {
          const url = new URL($iframe.attr('src')!)
          expect(url.origin).to.eq('https://player.vimeo.com')
          expect(url.pathname).to.eq('/video/123456789')
          expect(url.searchParams.get('h')).to.eq(hash)
        })
      }
      checkPlayer()
      cy.getEditor().then((editor) => {
        editor.commands.setContent(editor.getHTML())
      })
      checkPlayer()
    })
  }

  it('inserts a SoundCloud embed with w.soundcloud.com player src', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setSoundCloud({ src: 'https://soundcloud.com/forss/flickermood' })
    })
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'w.soundcloud.com/player')
    cy.nodeCount('soundcloud').should('eq', 1)
  })
})

export {}
