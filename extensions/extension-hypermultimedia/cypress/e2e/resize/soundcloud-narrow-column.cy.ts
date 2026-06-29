describe('SoundCloud layout on narrow columns', () => {
  beforeEach(() => {
    cy.viewport(375, 667)
    cy.visitPlayground()
  })

  it('keeps the committed height when the column is narrower than attrs.width', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setSoundCloud({
        src: 'https://soundcloud.com/forss/flickermood',
        width: 450,
        height: 120
      })
    })

    cy.get('#editor .hypermultimedia--soundcloud__content .hm-media-host').should(($host) => {
      const height = $host[0].getBoundingClientRect().height
      expect(height).to.be.at.least(115)
    })
  })

  it('does not shrink below the committed height after a small resize', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setSoundCloud({
        src: 'https://soundcloud.com/forss/flickermood',
        width: 200,
        height: 120
      })
    })

    cy.get('#editor .hypermultimedia--soundcloud__content .hm-media-host').should(($host) => {
      const height = $host[0].getBoundingClientRect().height
      expect(height).to.be.at.least(115)
    })
  })
})

export {}
