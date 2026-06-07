describe('X embed toolbar', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.intercept('GET', 'https://publish.twitter.com/oembed*', {
      statusCode: 200,
      body: {
        html: '<blockquote class="twitter-tweet"><p>stub tweet</p></blockquote>'
      }
    }).as('xOembed')
  })

  it('does not mount a resize gripper for x embeds', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.get('#editor .hypermultimedia__resize-gripper').should('not.exist')
  })

  it('opens toolbar on hover with size and theme in the overflow menu', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembed')
    cy.hoverMediaControls('#editor .hypermultimedia--x__content')
    cy.get('.media-toolbar[data-node-type="x"]').should('have.length', 1)
    cy.get('.media-toolbar[data-node-type="x"] .media-toolbar__more').click()
    cy.get('.media-toolbar__menu .media-toolbar__submenu-item').contains('Compact').should('exist')
    cy.get('.media-toolbar__menu .media-toolbar__submenu-item').contains('Wide').should('exist')
    cy.get('.media-toolbar__menu .media-toolbar__submenu-item').contains('Dark').should('exist')
  })

  it('writes maxwidth when a size preset is chosen', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembed')
    cy.hoverMediaControls('#editor .hypermultimedia--x__content')
    cy.get('.media-toolbar[data-node-type="x"] .media-toolbar__more').click()
    cy.get('.media-toolbar__menu .media-toolbar__submenu-item').contains('Wide').click()
    cy.nodeAttr('x', 'maxwidth').should('eq', 550)
  })

  it('writes theme when a theme preset is chosen', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembed')
    cy.hoverMediaControls('#editor .hypermultimedia--x__content')
    cy.get('.media-toolbar[data-node-type="x"] .media-toolbar__more').click()
    cy.get('.media-toolbar__menu .media-toolbar__submenu-item').contains('Dark').click()
    cy.nodeAttr('x', 'theme').should('eq', 'dark')
  })
})

export {}
