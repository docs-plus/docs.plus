/// <reference types="cypress" />

/** Shared fixture URLs (paste-matrix parity). */
const FIXTURES = {
  image: 'https://example.com/photo.png',
  audio: 'https://example.com/track.mp3',
  video: 'https://example.com/clip.mp4',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  vimeo: 'https://vimeo.com/123456789',
  soundcloud: 'https://soundcloud.com/forss/flickermood',
  loom: 'https://www.loom.com/share/abcdef1234567890',
  x: 'https://x.com/jack/status/20'
} as const

type MediaNode = keyof typeof FIXTURES

const MARKDOWN_SYNTAX: Record<MediaNode, (url: string) => string> = {
  image: (url) => `![Alt text](${url})`,
  audio: (url) => `![audio](${url})`,
  video: (url) => `![video](${url})`,
  youtube: (url) => `![youtube](${url})`,
  vimeo: (url) => `![vimeo](${url})`,
  soundcloud: (url) => `![soundcloud](${url})`,
  loom: (url) => `![loom](${url})`,
  x: (url) => `![x](${url})`
}

const MEDIA_NODES = [
  'image',
  'audio',
  'video',
  'youtube',
  'vimeo',
  'soundcloud',
  'loom',
  'x'
] as const

function markdownAltForNode(node: MediaNode): string {
  return node === 'image' ? 'Alt text' : node
}

describe('Markdown import/export — all media nodes', () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 200,
      body: { html: '<blockquote class="twitter-tweet"><p>stub</p></blockquote>' }
    })
    cy.visitPlayground('blockquote=off')
    cy.setEditorContent('<p></p>')
  })

  describe('full round-trip (setMarkdown → getMarkdown)', () => {
    MEDIA_NODES.forEach((node) => {
      it(`round-trips ${node} via parse and export`, () => {
        const md = MARKDOWN_SYNTAX[node](FIXTURES[node])
        cy.setMarkdown(md)
        cy.nodeCount(node).should('eq', 1)
        cy.get('#editor a').should('not.exist')
        cy.getMarkdown().then((exported) => {
          expect(exported).to.include(`![${markdownAltForNode(node)}]`)
          expect(exported).to.include(FIXTURES[node])
        })
      })
    })

    it('round-trips audio width/height attrs', () => {
      const md = `![audio](${FIXTURES.audio} width=400 height=80)`
      cy.setMarkdown(md)
      cy.nodeCount('audio').should('eq', 1)
      cy.getMarkdown().then((exported) => {
        expect(exported).to.include(FIXTURES.audio)
        expect(exported).to.include('width=400')
        expect(exported).to.include('height=80')
      })
    })
  })

  describe('command insert → export', () => {
    MEDIA_NODES.forEach((node) => {
      it(`exports ${node} inserted via command as typed markdown`, () => {
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
              editor.commands.setVideo({ src: url })
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
        cy.getMarkdown().then((md) => {
          expect(md).to.include(`![${markdownAltForNode(node)}]`)
          expect(md).to.include(FIXTURES[node])
        })
      })
    })
  })

  describe('image edge cases', () => {
    it('round-trips empty alt', () => {
      cy.setMarkdown(`![](${FIXTURES.image})`)
      cy.nodeCount('image').should('eq', 1)
      cy.getMarkdown().should('include', `![](${FIXTURES.image})`)
    })

    it('does not treat reserved ![youtube] syntax as a plain image', () => {
      cy.setMarkdown(MARKDOWN_SYNTAX.youtube(FIXTURES.youtube))
      cy.nodeCount('youtube').should('eq', 1)
      cy.nodeCount('image').should('eq', 0)
    })

    it('drops caption on markdown export (documented lossy contract)', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setImage({ src: FIXTURES.image, alt: 'Alt', caption: 'Fig 1' })
      })
      cy.getMarkdown().should('include', `![Alt](${FIXTURES.image})`)
      cy.getMarkdown().should('not.include', 'Fig 1')
    })
  })

  describe('hyperlink coexistence', () => {
    it('keeps provider URLs as embed nodes, not hyperlinks', () => {
      cy.setMarkdown(`Watch ${MARKDOWN_SYNTAX.youtube(FIXTURES.youtube)} now.`)
      cy.nodeCount('youtube').should('eq', 1)
      cy.get('#editor a').should('not.exist')
    })

    it('still autolinks non-media URLs in markdown paragraphs', () => {
      cy.setMarkdown('See [Docs](https://example.com/docs) for details.')
      cy.get('#editor a[href="https://example.com/docs"]').should('exist')
      cy.nodeCount('youtube').should('eq', 0)
    })
  })
})

export {}
