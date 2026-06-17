/** Loading shell: reserved-size overlay until remote media / embeds are ready. */

import { TINY_PNG_BASE64 } from '../../support/e2e'

const REMOTE_IMAGE = 'https://example.com/photo.png'
const BROKEN_IMAGE = 'https://example.com/broken.png'
const YOUTUBE_SCOPE = '#editor .hypermultimedia--youtube__content'

describe('media loading shell', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  it('shows a YouTube shell on insert, then reveals the iframe when ready', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    cy.nodeCount('youtube').should('eq', 1)
    cy.expectMediaLoadingPending('YouTube', YOUTUBE_SCOPE)
    cy.get(`${YOUTUBE_SCOPE} iframe`).should('exist')
    cy.expectMediaLoadingReady(YOUTUBE_SCOPE)
    cy.get('#editor iframe')
      .should('have.attr', 'src')
      .and('match', /youtube/i)
    cy.get(`${YOUTUBE_SCOPE} .hm-loading-shell__overlay`).should('not.be.visible')
  })

  it('shows an error shell when the image fails to load', () => {
    cy.intercept('GET', BROKEN_IMAGE, { statusCode: 404, body: '' }).as('brokenImage')

    cy.getEditor().then((editor) => {
      editor.commands.setImage({ src: BROKEN_IMAGE, width: 120, height: 80 })
    })
    cy.expectMediaLoadingPending()
    cy.wait('@brokenImage')
    cy.expectMediaLoadingError('Could not load media')
    cy.get('#editor img[src="' + BROKEN_IMAGE + '"]').should('exist')
  })

  it('shows a shell while a remote image loads, then reveals the image', () => {
    cy.intercept('GET', REMOTE_IMAGE, (req) => {
      const binary = atob(TINY_PNG_BASE64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      req.reply({
        delay: 400,
        statusCode: 200,
        headers: { 'content-type': 'image/png' },
        body: bytes.buffer
      })
    }).as('remoteImage')

    cy.getEditor().then((editor) => {
      editor.commands.setImage({ src: REMOTE_IMAGE, width: 120, height: 80 })
    })
    cy.expectMediaLoadingPending()
    cy.wait('@remoteImage')
    cy.expectMediaLoadingReady()
    cy.get('#editor img[src="' + REMOTE_IMAGE + '"]').should('be.visible')
  })

  it('shows an X shell on paste, then clears it after oEmbed resolves', () => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 200,
      body: { html: '<blockquote class="twitter-tweet"><p>stub</p></blockquote>' }
    }).as('xOembed')

    cy.pastePlainText('https://x.com/jack/status/20')
    cy.expectMediaLoadingPending('X')
    cy.wait('@xOembed')
    cy.expectMediaLoadingReady()
    cy.nodeCount('x').should('eq', 1)
  })

  it('shows a shell when pasting a YouTube URL', () => {
    cy.pastePlainText('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    cy.nodeCount('youtube').should('eq', 1)
    cy.expectMediaLoadingPending('YouTube', YOUTUBE_SCOPE)
    cy.expectMediaLoadingReady(YOUTUBE_SCOPE)
    cy.get('#editor iframe')
      .should('have.attr', 'src')
      .and('match', /youtube/i)
  })

  it('skips the overlay when loadingShell is false', () => {
    cy.visitPlayground('loadingShell=false')
    cy.setEditorContent('<p></p>')
    cy.getEditor().then((editor) => {
      editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    cy.get('#editor .hm-loading-shell__overlay').should('not.exist')
    cy.get('#editor .hm-media-host[data-hm-loading]').should('not.exist')
    cy.get('#editor iframe[src*="youtube"]', { timeout: 20000 }).should('exist')
  })
})

export {}
