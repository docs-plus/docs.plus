/** #637: an `<img>` keeps a src with no image file extension; bare text still needs one. */

const NO_EXTENSION = 'https://picsum.photos/id/1/200/100'

describe('image src without a file extension (#637)', () => {
  beforeEach(() => {
    cy.intercept('GET', NO_EXTENSION, { statusCode: 404, body: '' })
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  it('keeps an <img> from setContent', () => {
    cy.setEditorContent(`<p>a</p><img src="${NO_EXTENSION}"><p>b</p>`)
    cy.nodeCount('image').should('eq', 1)
    cy.nodeAttr('image', 'src').should('eq', NO_EXTENSION)
  })

  it('keeps an <img> from an HTML paste', () => {
    cy.pasteHtml(`<p>before</p><img src="${NO_EXTENSION}" alt="photo"><p>after</p>`)
    cy.nodeCount('image').should('eq', 1)
    cy.nodeAttr('image', 'src').should('eq', NO_EXTENSION)
  })

  it('keeps a bare pasted URL with no extension as text', () => {
    cy.pastePlainText(NO_EXTENSION)
    cy.nodeCount('image').should('eq', 0)
    cy.get('#editor .ProseMirror').should('contain.text', NO_EXTENSION)
  })

  it('still refuses an unsafe, relative or hostless <img> src', () => {
    cy.setEditorContent(
      '<p>a</p><img src="javascript:alert(1)"><img src="vbscript:x"><img src="/x.png">' +
        '<img src="https://"><img src="//javascript:alert(1)"><p>b</p>'
    )
    cy.nodeCount('image').should('eq', 0)
  })

  it('shows where a failed image comes from, and hides the broken glyph', () => {
    cy.setEditorContent(`<img src="${NO_EXTENSION}">`)
    cy.expectMediaLoadingError('Couldn’t load this image')
    cy.get('#editor .hm-loading-shell__detail').should(
      'have.text',
      'From picsum.photos. The link may be broken.'
    )
    cy.get('#editor .hm-media-slot > img').should('have.css', 'opacity', '0')
  })
})

export {}
