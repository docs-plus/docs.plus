describe('X embed mount lifecycle', () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 200,
      body: { html: '<blockquote class="twitter-tweet"><p>stub</p></blockquote>' }
    }).as('xOembed')
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  it('aborts in-flight mount when the editor is destroyed', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
      editor.destroy()
    })

    cy.get('#editor .hypermultimedia--x__content').should('not.exist')
    cy.get('body').realPress('Backspace')
  })

  it('keeps height sync active until the node view is destroyed', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setX({ src: 'https://x.com/jack/status/20' })
    })
    cy.wait('@xOembed')
    cy.expectMediaLoadingReady()
    cy.get('#editor .hm-media-host--fluid').should('exist')
    cy.nodeCount('x').should('eq', 1)
  })
})

export {}
