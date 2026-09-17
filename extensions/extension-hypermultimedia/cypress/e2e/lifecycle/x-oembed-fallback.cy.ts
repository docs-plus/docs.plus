const STATUS_URL = 'https://x.com/jack/status/20'
const WRAPPER = '#editor .hypermultimedia--x__content'

describe('X oEmbed failure', () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', { forceNetworkError: true }).as('oembed')
    cy.intercept('GET', 'https://platform.twitter.com/widgets.js', { forceNetworkError: true })
    cy.visitPlayground('xOptions=custom')
    cy.setEditorContent('<p></p>')
  })

  for (const entry of ['command', 'paste'] as const) {
    it(`keeps a visible link and widget options after ${entry} when both X endpoints fail`, () => {
      if (entry === 'command') {
        cy.getEditor().then((editor) => editor.commands.setX({ src: STATUS_URL }))
      } else {
        cy.get('#editor .ProseMirror').focus()
        cy.pastePlainText(STATUS_URL)
      }

      cy.wait('@oembed')
      cy.expectMediaLoadingReady()
      cy.get(`${WRAPPER} .hm-media-slot`).should('have.css', 'opacity', '1')
      cy.get(`${WRAPPER} blockquote.twitter-tweet`).should(($quote) => {
        expect($quote.attr('data-theme')).to.equal('dark')
        expect($quote.attr('data-width')).to.equal('400')
        expect($quote.attr('data-lang')).to.equal('fr')
        expect($quote.attr('data-dnt')).to.equal('false')
        expect($quote.attr('data-cards')).to.equal('hidden')
        expect($quote.attr('data-conversation')).to.equal('none')
      })
      cy.get(`${WRAPPER} blockquote a`)
        .should('be.visible')
        .and('have.attr', 'href', STATUS_URL)
        .and('have.text', STATUS_URL)
    })
  }
})

export {}
