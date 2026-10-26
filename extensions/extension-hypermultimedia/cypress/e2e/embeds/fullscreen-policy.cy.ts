/// <reference types="cypress" />

/**
 * Fullscreen lives only in `allow`. Chrome warns "Allow attribute will take precedence
 * over 'allowfullscreen'" when the legacy attribute sits beside it.
 */

const EMBEDS = {
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  vimeo: 'https://vimeo.com/123456789',
  spotify: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
  loom: 'https://www.loom.com/share/abcdef1234567890'
} as const

type EmbedNode = keyof typeof EMBEDS

function insertEmbed(node: EmbedNode, allowfullscreen?: boolean): void {
  cy.getEditor().then((editor) => {
    const options = {
      src: EMBEDS[node],
      ...(allowfullscreen === undefined ? {} : { allowfullscreen })
    }
    const commands = {
      youtube: () => editor.commands.setYoutubeVideo(options),
      vimeo: () => editor.commands.setVimeo(options),
      spotify: () => editor.commands.setSpotify(options),
      loom: () => editor.commands.setLoom(options)
    }
    expect(commands[node](), `insert ${node}`).to.eq(true)
  })
}

const allowFeatures = (iframe: Element): string[] =>
  (iframe.getAttribute('allow') ?? '')
    .split(';')
    .map((directive) => directive.trim().split(/\s+/, 1)[0])
    .filter(Boolean)

function expectFullscreenPolicy(iframe: Element | null, fullscreen: boolean, label: string): void {
  expect(iframe, `${label} iframe`).not.to.eq(null)
  expect(iframe!.hasAttribute('allowfullscreen'), `${label} legacy allowfullscreen`).to.eq(false)
  if (fullscreen) expect(allowFeatures(iframe!), `${label} allow`).to.include('fullscreen')
  else expect(allowFeatures(iframe!), `${label} allow`).not.to.include('fullscreen')
}

function expectLiveAndSerialized(node: EmbedNode, fullscreen: boolean): void {
  cy.get(`#editor .hypermultimedia--${node}__content iframe`).then(($iframe) => {
    expectFullscreenPolicy($iframe[0], fullscreen, `${node} live`)
  })
  cy.getEditor().then((editor) => {
    const doc = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
    expectFullscreenPolicy(doc.querySelector('iframe'), fullscreen, `${node} getHTML`)
  })
}

describe('iframe embeds express fullscreen only through allow', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  ;(Object.keys(EMBEDS) as EmbedNode[]).forEach((node) => {
    it(`${node}: allow names fullscreen and the legacy attribute is gone`, () => {
      insertEmbed(node)
      expectLiveAndSerialized(node, true)
    })

    it(`${node}: allowfullscreen false removes fullscreen from allow`, () => {
      insertEmbed(node, false)
      expectLiveAndSerialized(node, false)
    })
  })

  it('the new markup parses back through getHTML → setContent with fullscreen kept', () => {
    ;(Object.keys(EMBEDS) as EmbedNode[]).forEach((node) => insertEmbed(node))
    cy.getEditor().then((editor) => {
      editor.commands.setContent(editor.getHTML())
    })
    ;(Object.keys(EMBEDS) as EmbedNode[]).forEach((node) => {
      cy.nodeCount(node).should('eq', 1)
      cy.get(`#editor .hypermultimedia--${node}__content iframe`).then(($iframe) => {
        expectFullscreenPolicy($iframe[0], true, `${node} after round trip`)
      })
    })
  })

  it('an allow list without fullscreen gains it (stored YouTube nodes kept the old default)', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setYoutubeVideo({
        src: EMBEDS.youtube,
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      })
    })
    expectLiveAndSerialized('youtube', true)
  })

  it('a pasted Spotify "Copy embed" iframe with a bare allowfullscreen keeps fullscreen', () => {
    cy.setEditorContent(
      '<iframe src="https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl?utm_source=generator" width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>'
    )
    cy.nodeCount('spotify').should('eq', 1)
    expectLiveAndSerialized('spotify', true)
  })
})

export {}
