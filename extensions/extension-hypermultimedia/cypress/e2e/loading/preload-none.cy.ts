/** `preload: 'none'` media fetches nothing, so the shell must settle without a load event. */

const VIDEO_SCOPE = '#editor .hypermultimedia--video__content'
const AUDIO_SCOPE = '#editor .hypermultimedia--audio__content'

describe('preload="none" media', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  // Regression: `preload: 'none'` fires none of load/loadeddata/canplay and holds
  // readyState at HAVE_NOTHING, so a readyState-only probe left the shell on
  // `pending`. The `.hm-media-slot` is opacity 0 until ready/error, which hides
  // the player rather than merely dropping the spinner.
  it('reveals a video whose controls need no buffered data', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setVideo({
        src: 'https://example.com/clip.mp4',
        preload: 'none',
        width: 320,
        height: 180
      })
    })
    cy.expectMediaLoadingReady(VIDEO_SCOPE)
    cy.get(`${VIDEO_SCOPE} .hm-media-slot`).should('have.css', 'opacity', '1')
    cy.get(`${VIDEO_SCOPE} video`).should('be.visible')
  })

  it('reveals an audio player whose controls need no buffered data', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setAudio({ src: 'https://example.com/track.mp3', preload: 'none' })
    })
    cy.expectMediaLoadingReady(AUDIO_SCOPE)
    cy.get(`${AUDIO_SCOPE} .hm-media-slot`).should('have.css', 'opacity', '1')
  })

  // Control: the default path must still run on real load/error events, or the
  // fix above would have short-circuited every media node straight to `ready`.
  it('still settles on the load event when preload is left at the default', () => {
    cy.intercept('GET', 'https://example.com/missing.mp4', { statusCode: 404, body: '' }).as(
      'missingVideo'
    )
    cy.getEditor().then((editor) => {
      editor.commands.setVideo({ src: 'https://example.com/missing.mp4', width: 320, height: 180 })
    })
    cy.expectMediaLoadingError('Could not load media', VIDEO_SCOPE)
  })
})

export {}
