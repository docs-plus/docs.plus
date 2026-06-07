describe('window._hypermultimedia isMediaUrl contract', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('exposes isMediaUrl on the playground global', () => {
    cy.window().its('_hypermultimedia.isMediaUrl').should('be.a', 'function')
    cy.window().then((win) => {
      expect(win._hypermultimedia.isMediaUrl('https://example.com/photo.png')).to.be.true
      expect(win._hypermultimedia.isMediaUrl('https://example.com/about')).to.be.false
      expect(
        win._hypermultimedia.isMediaUrl('https://x.com/elonmusk/status/2059299542277697565?s=20')
      ).to.be.true
    })
  })
})

export {}
