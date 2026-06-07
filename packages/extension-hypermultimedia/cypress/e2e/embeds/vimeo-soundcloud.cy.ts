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

  it('inserts a SoundCloud embed with w.soundcloud.com player src', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setSoundCloud({ src: 'https://soundcloud.com/forss/flickermood' })
    })
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'w.soundcloud.com/player')
    cy.nodeCount('soundcloud').should('eq', 1)
  })
})

export {}
