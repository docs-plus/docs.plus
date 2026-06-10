/// <reference types="cypress" />

const VIDEO_SRC = 'https://example.com/clip.mp4'
const AUDIO_SRC = 'https://example.com/track.mp3'

describe('video/audio HTML serialization', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.getEditor().then((editor) => {
      editor.commands.setVideo({ src: VIDEO_SRC, width: 400, height: 300 })
      editor.commands.setAudio({ src: AUDIO_SRC })
    })
    cy.nodeCount('video').should('eq', 1)
    cy.nodeCount('audio').should('eq', 1)
  })

  it('getHTML does not throw once a video and an audio node exist', () => {
    cy.getEditor().then((editor) => {
      expect(() => editor.getHTML()).not.to.throw()
      const html = editor.getHTML()
      expect(html).to.include('data-video')
      expect(html).to.include('<video')
      expect(html).to.include(VIDEO_SRC)
      expect(html).to.include('data-audio')
      expect(html).to.include('<audio')
      expect(html).to.include(AUDIO_SRC)
    })
  })

  it('round-trips video and audio through setContent without losing nodes', () => {
    cy.getEditor().then((editor) => {
      const html = editor.getHTML()
      editor.commands.setContent(html)
    })
    cy.nodeCount('video').should('eq', 1)
    cy.nodeCount('audio').should('eq', 1)
  })

  it('toolbar Copy on a video serializes the node without throwing', () => {
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'write').as('clipboardWrite').resolves()
      cy.stub(win.navigator.clipboard, 'writeText').as('clipboardWriteText').resolves()
    })
    cy.hoverMediaControls('#editor .hypermultimedia--video__content')
    cy.get('#editor .hypermultimedia--video__content .media-toolbar .media-toolbar__more').click()
    cy.get('.media-toolbar__menu [data-action-id="copy"]').click()
    // DOMSerializer ran (clipboard payload built) and nothing threw.
    cy.get('@clipboardWrite').should('have.been.called')
    cy.nodeCount('video').should('eq', 1)
  })
})

export {}
