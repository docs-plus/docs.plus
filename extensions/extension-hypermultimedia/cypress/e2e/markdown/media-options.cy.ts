/// <reference types="cypress" />

import { FIXTURES, type MediaNode } from './fixtures'

const MEDIA_NODES = Object.keys(FIXTURES) as MediaNode[]

const altFor = (node: MediaNode): string => (node === 'image' ? 'Alt text' : node)

function expectAttrs(node: MediaNode, attrs: Record<string, unknown>): void {
  cy.nodeCount(node).should('eq', 1)
  Object.entries(attrs).forEach(([key, value]) => {
    cy.nodeAttr(node, key).should('deep.equal', value)
  })
}

/**
 * Imports `markdown`, checks the attrs, checks that export writes `expected`, then imports
 * that export again and checks the same attrs. The second leg is the round trip.
 */
function roundTrip(
  node: MediaNode,
  markdown: string,
  attrs: Record<string, unknown>,
  expected = markdown
): void {
  cy.setMarkdown(markdown)
  expectAttrs(node, attrs)
  cy.getMarkdown().should('include', expected)
  cy.getMarkdown().then((exported) => cy.setMarkdown(exported))
  expectAttrs(node, attrs)
  cy.getMarkdown().should('include', expected)
}

describe('Markdown media options', () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://publish.x.com/oembed*', {
      statusCode: 200,
      body: { html: '<blockquote class="twitter-tweet"><p>stub</p></blockquote>' }
    })
    cy.visitPlayground('blockquote=off')
    cy.setEditorContent('<p></p>')
  })

  describe('caption in the title slot', () => {
    MEDIA_NODES.forEach((node) => {
      it(`round-trips the ${node} caption through Markdown`, () => {
        const md = `![${altFor(node)}](${FIXTURES[node]} "Caption one")`
        roundTrip(node, md, { caption: 'Caption one' })
      })

      it(`keeps the ${node} caption from Markdown through an HTML round trip`, () => {
        cy.setMarkdown(`![${altFor(node)}](${FIXTURES[node]} "Caption one")`)
        cy.getEditor().then((editor) => editor.commands.setContent(editor.getHTML()))
        expectAttrs(node, { caption: 'Caption one' })
      })
    })

    it('escapes a quote and a backslash in the caption', () => {
      roundTrip('audio', `![audio](${FIXTURES.audio} "Say \\"hi\\" \\\\ now")`, {
        caption: 'Say "hi" \\ now'
      })
    })

    it('writes no title for a node without a caption', () => {
      cy.setMarkdown(`![youtube](${FIXTURES.youtube})`)
      cy.getMarkdown().should('include', `![youtube](${FIXTURES.youtube})`)
      cy.getMarkdown().should('not.include', '"')
    })
  })

  describe('layout option block', () => {
    const LAYOUT: Record<Exclude<MediaNode, 'x'>, string> = {
      image: '{width=300 height=200 float=left margin=0.5in}',
      audio: '{width=400 height=80 clear=both}',
      video: '{width=400 height=300 float=right margin=0.25in}',
      youtube: '{width=480 height=270 display=inline-block justify-content=center}',
      vimeo: '{width=480 height=270 float=left margin="0 0 0 auto"}',
      soundcloud: '{width=480 height=166 clear=left}',
      spotify: '{width=480 height=352 margin=0}',
      loom: '{width=480 height=270 float=right}'
    }
    const LAYOUT_ATTRS: Record<Exclude<MediaNode, 'x'>, Record<string, unknown>> = {
      image: { width: 300, height: 200, float: 'left', margin: '0.5in' },
      audio: { width: 400, height: 80, clear: 'both' },
      video: { width: 400, height: 300, float: 'right', margin: '0.25in' },
      youtube: { width: 480, height: 270, display: 'inline-block', justifyContent: 'center' },
      vimeo: { width: 480, height: 270, float: 'left', margin: '0 0 0 auto' },
      soundcloud: { width: 480, height: 166, clear: 'left' },
      spotify: { width: 480, height: 352, margin: '0' },
      loom: { width: 480, height: 270, float: 'right' }
    }

    ;(Object.keys(LAYOUT) as Exclude<MediaNode, 'x'>[]).forEach((node) => {
      it(`round-trips the ${node} layout block`, () => {
        const md = `![${altFor(node)}](${FIXTURES[node]})${LAYOUT[node]}`
        roundTrip(node, md, LAYOUT_ATTRS[node])
      })
    })

    it('round-trips the x layout block', () => {
      roundTrip('x', `![x](${FIXTURES.x}){float=right margin=0.5in}`, {
        float: 'right',
        margin: '0.5in'
      })
    })

    it('reads justifyContent and writes justify-content', () => {
      roundTrip(
        'youtube',
        `![youtube](${FIXTURES.youtube}){justifyContent=center}`,
        { justifyContent: 'center' },
        `![youtube](${FIXTURES.youtube}){justify-content=center}`
      )
    })

    it('writes caption and block together, in that order', () => {
      roundTrip(
        'youtube',
        `![youtube](${FIXTURES.youtube} "How docs.plus works"){width=480 float=right}`,
        { caption: 'How docs.plus works', width: 480, float: 'right' }
      )
    })

    it('renders the block size and float on the player, not only the attrs', () => {
      cy.setMarkdown(`![video](${FIXTURES.video}){width=400 height=300}`)
      cy.expectRenderedMediaSize('#editor .hypermultimedia--video__content video', 'width', 400)
      cy.expectRenderedMediaSize('#editor .hypermultimedia--video__content video', 'height', 300)

      cy.setMarkdown(`![youtube](${FIXTURES.youtube}){width=400 height=300 float=right}`)
      cy.expectRenderedMediaSize('#editor .hm-media-host', 'width', 400)
      cy.expectRenderedMediaSize('#editor .hm-media-host', 'height', 300)
      cy.get('#editor .hypermultimedia--youtube__content').should('have.css', 'float', 'right')
    })

    // `x` because its tokenizer runs after the image one. See createImageMarkdownHooks.
    it('keeps a reserved x alt with a block on its own node', () => {
      cy.setMarkdown(`![x](${FIXTURES.x}){float=right}`)
      cy.nodeCount('x').should('eq', 1)
      cy.nodeCount('image').should('eq', 0)
    })

    it('reads the block of an image whose alt names a prototype key', () => {
      cy.setMarkdown(`![toString](${FIXTURES.image}){width=300}`)
      expectAttrs('image', { alt: 'toString', width: 300 })
      cy.get('#editor').should('not.contain.text', '{width=300}')
    })
  })

  describe('emit only what differs from the default', () => {
    it('writes no block for a node at its defaults', () => {
      cy.setMarkdown(`![video](${FIXTURES.video})`)
      expectAttrs('video', { width: 640, height: 480 })
      cy.getMarkdown().should('include', `![video](${FIXTURES.video})`)
      cy.getMarkdown().should('not.include', '{')
    })

    it('drops a block value equal to the default on export', () => {
      cy.setMarkdown(`![video](${FIXTURES.video}){width=640 height=480 controls=true}`)
      cy.getMarkdown().should('include', `![video](${FIXTURES.video})`)
      cy.getMarkdown().should('not.include', '{')
    })

    it('treats the toolbar float none as the default', () => {
      // setContent, not the insert command: the command fits the size to the column.
      cy.getEditor().then((editor) => {
        editor.commands.setContent({
          type: 'doc',
          content: [
            {
              type: 'youtube',
              attrs: { src: FIXTURES.youtube, float: 'none', clear: 'none', margin: 'auto' }
            }
          ]
        })
      })
      cy.nodeAttr('youtube', 'float').should('eq', 'none')
      cy.getMarkdown().should('include', `![youtube](${FIXTURES.youtube})`)
      cy.getMarkdown().should('not.include', '{')
    })
  })

  describe('values the block refuses', () => {
    it('drops unknown keys and values that fail their check', () => {
      cy.setMarkdown(
        `![youtube](${FIXTURES.youtube}){width=abc float=up margin="red;x" display=none evil=1}`
      )
      expectAttrs('youtube', { width: 640, float: null, margin: 'auto', display: 'block' })
      cy.getMarkdown().should('not.include', '{')
    })

    it('drops a poster with a dangerous scheme and keeps the video', () => {
      cy.setMarkdown(`![video](${FIXTURES.video}){poster=javascript:alert(1)}`)
      expectAttrs('video', { poster: null, src: FIXTURES.video })
      cy.getMarkdown().should('not.include', 'javascript')
    })
  })

  describe('old in-parenthesis size', () => {
    it('imports the old video shape and writes the block', () => {
      roundTrip(
        'video',
        `![video](${FIXTURES.video} width=400 height=300)`,
        { width: 400, height: 300 },
        `![video](${FIXTURES.video}){width=400 height=300}`
      )
    })

    it('imports the old audio shape and writes the block', () => {
      roundTrip(
        'audio',
        `![audio](${FIXTURES.audio} width=400 height=80)`,
        { width: 400, height: 80 },
        `![audio](${FIXTURES.audio}){width=400 height=80}`
      )
    })
  })

  describe('player options', () => {
    it('round-trips every video player option', () => {
      const poster = 'https://example.com/poster.png'
      roundTrip(
        'video',
        `![video](${FIXTURES.video}){controls=false autoplay=true loop=true muted=true preload=none poster=${poster}}`,
        {
          controls: false,
          autoplay: true,
          loop: true,
          muted: true,
          preload: 'none',
          poster
        }
      )
      cy.get('#editor video').should('have.attr', 'loop')
      cy.get('#editor video').should('not.have.attr', 'controls')
      cy.get('#editor video').should('have.attr', 'poster', poster)
    })

    it('round-trips every audio player option', () => {
      roundTrip(
        'audio',
        `![audio](${FIXTURES.audio}){controls=false autoplay=true loop=true muted=true preload=none}`,
        { controls: false, autoplay: true, loop: true, muted: true, preload: 'none' }
      )
      cy.get('#editor audio').should('have.attr', 'loop')
    })

    it('round-trips the x oEmbed set', () => {
      roundTrip(
        'x',
        `![x](${FIXTURES.x}){maxwidth=550 theme=dark lang=fr hide_media=true hide_thread=true}`,
        { maxwidth: 550, theme: 'dark', lang: 'fr', hide_media: true, hide_thread: true }
      )
    })
  })

  describe('import fixes', () => {
    it('gives an imported Spotify track the track height and writes no block', () => {
      cy.setMarkdown(`![spotify](${FIXTURES.spotify}?si=abc)`)
      expectAttrs('spotify', { height: 152, src: FIXTURES.spotify })
      cy.getMarkdown().should('include', `![spotify](${FIXTURES.spotify})`)
      cy.getMarkdown().should('not.include', '{')
    })

    it('stores a normalized X src on import', () => {
      cy.setMarkdown('![x](https://twitter.com/jack/status/20?s=20)')
      expectAttrs('x', { src: FIXTURES.x })
    })
  })
})

export {}
