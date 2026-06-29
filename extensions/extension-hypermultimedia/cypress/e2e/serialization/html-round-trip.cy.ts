/// <reference types="cypress" />

/** Shared fixture URLs (paste-matrix / markdown-round-trip parity). */
const FIXTURES = {
  image: 'https://example.com/photo.png',
  audio: 'https://example.com/track.mp3',
  video: 'https://example.com/clip.mp4',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  vimeo: 'https://vimeo.com/123456789',
  soundcloud: 'https://soundcloud.com/forss/flickermood',
  spotify: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
  loom: 'https://www.loom.com/share/abcdef1234567890',
  x: 'https://x.com/jack/status/20'
} as const

type MediaNode = keyof typeof FIXTURES

function insertMediaNode(node: MediaNode): void {
  cy.getEditor().then((editor) => {
    const url = FIXTURES[node]
    switch (node) {
      case 'image':
        editor.commands.setImage({ src: url, alt: 'Alt text' })
        break
      case 'audio':
        editor.commands.setAudio({ src: url })
        break
      case 'video':
        editor.commands.setVideo({ src: url, width: 400, height: 300 })
        break
      case 'youtube':
        editor.commands.setYoutubeVideo({ src: url })
        break
      case 'vimeo':
        editor.commands.setVimeo({ src: url })
        break
      case 'soundcloud':
        editor.commands.setSoundCloud({ src: url })
        break
      case 'spotify':
        editor.commands.setSpotify({ src: url })
        break
      case 'loom':
        editor.commands.setLoom({ src: url })
        break
      case 'x':
        editor.commands.setX({ src: url })
        break
      default: {
        const _exhaustive: never = node
        throw new Error(`Unhandled node: ${_exhaustive}`)
      }
    }
  })
}

function roundTripHtml(): void {
  cy.getEditor().then((editor) => {
    const html = editor.getHTML()
    editor.commands.setContent(html)
  })
}

describe('HTML copy/paste round-trip (getHTML → setContent)', () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 200,
      body: { html: '<blockquote class="twitter-tweet"><p>stub</p></blockquote>' }
    })
    cy.visitPlayground('blockquote=off')
    cy.setEditorContent('<p></p>')
  })

  it('round-trips image and keeps the canonical src', () => {
    insertMediaNode('image')
    cy.nodeCount('image').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('image').should('eq', 1)
    cy.nodeAttr('image', 'src').should('eq', FIXTURES.image)
  })

  it('round-trips video and keeps the canonical src', () => {
    insertMediaNode('video')
    cy.nodeCount('video').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('video').should('eq', 1)
    cy.nodeAttr('video', 'src').should('eq', FIXTURES.video)
  })

  it('round-trips audio and keeps the canonical src', () => {
    insertMediaNode('audio')
    cy.nodeCount('audio').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('audio').should('eq', 1)
    cy.nodeAttr('audio', 'src').should('eq', FIXTURES.audio)
  })

  it('round-trips youtube and keeps a playable embed src', () => {
    insertMediaNode('youtube')
    cy.nodeCount('youtube').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('youtube').should('eq', 1)
    cy.nodeAttr('youtube', 'src').should('include', 'dQw4w9WgXcQ')
    cy.get('#editor iframe')
      .should('have.attr', 'src')
      .and('match', /youtube\.com|youtube-nocookie\.com/)
  })

  it('round-trips vimeo and keeps a playable embed src', () => {
    insertMediaNode('vimeo')
    cy.nodeCount('vimeo').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('vimeo').should('eq', 1)
    cy.nodeAttr('vimeo', 'src').should('include', '123456789')
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'player.vimeo.com')
  })

  it('round-trips soundcloud with the page URL in attrs, not the widget URL', () => {
    insertMediaNode('soundcloud')
    cy.nodeCount('soundcloud').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('soundcloud').should('eq', 1)
    cy.nodeAttr('soundcloud', 'src').should('eq', FIXTURES.soundcloud)
    cy.nodeAttr('soundcloud', 'src').should('not.include', 'w.soundcloud.com')
    cy.get('#editor iframe')
      .should('have.attr', 'src')
      .and('include', 'w.soundcloud.com/player')
      .and('include', encodeURIComponent(FIXTURES.soundcloud))
  })

  it('round-trips spotify and keeps a playable embed src', () => {
    insertMediaNode('spotify')
    cy.nodeCount('spotify').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('spotify').should('eq', 1)
    cy.nodeAttr('spotify', 'src').should('eq', FIXTURES.spotify)
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'open.spotify.com/embed')
  })

  it('round-trips loom and keeps a playable embed src', () => {
    insertMediaNode('loom')
    cy.nodeCount('loom').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('loom').should('eq', 1)
    cy.nodeAttr('loom', 'src').should('include', 'loom.com')
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'loom.com/embed')
  })

  it('round-trips x and keeps the normalized status URL', () => {
    insertMediaNode('x')
    cy.nodeCount('x').should('eq', 1)
    roundTripHtml()
    cy.nodeCount('x').should('eq', 1)
    cy.nodeAttr('x', 'src').should('include', 'jack/status/20')
  })
})

export {}
