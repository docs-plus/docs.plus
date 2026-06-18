/// <reference types="cypress" />

const IMAGE_CAPTION = '#editor .hypermultimedia--image__content .hm-caption'

function openImageCaption() {
  cy.get('#editor .media-toolbar [data-action-id="caption"]').click()
  cy.get(IMAGE_CAPTION).should('be.visible')
}

describe('media caption — authoring', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
  })

  it('reveals + commits a caption via the toolbar button', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('Sunset over the bay')
    cy.get(IMAGE_CAPTION).blur()
    cy.nodeAttr('image', 'caption').should('eq', 'Sunset over the bay')
  })

  it('first typed key after click-to-lock + caption toolbar keeps the image node', () => {
    cy.get('#editor img').click()
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('a')
    cy.nodeCount('image').should('eq', 1)
    cy.get(IMAGE_CAPTION).should('have.text', 'a')
  })

  it('commits and returns focus to the editor on Enter', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('Enter commits{enter}')
    cy.nodeAttr('image', 'caption').should('eq', 'Enter commits')
    cy.nodeCount('image').should('eq', 1)
    // Enter does not insert a newline into the caption text.
    cy.nodeAttr('image', 'caption').should('not.contain', '\n')
  })

  it('trims surrounding whitespace on commit', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('   padded caption   ')
    cy.get(IMAGE_CAPTION).blur()
    cy.nodeAttr('image', 'caption').should('eq', 'padded caption')
  })

  it('clears the caption to null when emptied then blurred', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('hi{backspace}{backspace}')
    cy.nodeCount('image').should('eq', 1)
    cy.get(IMAGE_CAPTION).blur()
    cy.nodeAttr('image', 'caption').should('eq', null)
  })
})

describe('media caption — delete keys must not destroy the node', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
  })

  it('Backspace mid-caption removes a character, not the image node', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('Hello')
    cy.get(IMAGE_CAPTION).type('{backspace}')
    cy.nodeCount('image').should('eq', 1)
    cy.get(IMAGE_CAPTION).should('have.text', 'Hell')
  })

  it('Backspace into an empty caption keeps the image node', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('Hi')
    cy.get(IMAGE_CAPTION).type('{backspace}{backspace}{backspace}{backspace}')
    cy.nodeCount('image').should('eq', 1)
    cy.get(IMAGE_CAPTION).should('have.text', '')
  })

  it('Delete (forward) while editing the caption keeps the image node', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('abc{leftArrow}{del}')
    cy.nodeCount('image').should('eq', 1)
    cy.get(IMAGE_CAPTION).should('have.text', 'ab')
  })

  it('Backspace still deletes the locked image when the caption is NOT focused', () => {
    // Guard against over-correction: delete-on-hover must keep working off-caption.
    cy.get('#editor img').trigger('mouseover', { force: true })
    cy.get('#editor .ProseMirror').trigger('keydown', { key: 'Backspace', bubbles: true })
    cy.nodeCount('image').should('eq', 0)
  })
})

describe('media caption — layout', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
  })

  it('grows the media wrapper to contain the caption (no overflow onto following text)', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('A caption that should claim its own vertical space')
    cy.get(IMAGE_CAPTION).blur()
    cy.get('#editor .hypermultimedia--image__content').then(($wrap) => {
      const wrap = $wrap[0].getBoundingClientRect()
      cy.get(IMAGE_CAPTION).then(($cap) => {
        const cap = $cap[0].getBoundingClientRect()
        // The caption sits inside the wrapper box, so following content can't collide with it.
        expect(cap.bottom, 'caption bottom within wrapper').to.be.lte(wrap.bottom + 1)
        expect(cap.top, 'caption top within wrapper').to.be.gte(wrap.top - 1)
      })
    })
  })
})

describe('media caption — serialization', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
  })

  it('round-trips a caption through HTML serialize → parse', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('Round trip')
    cy.get(IMAGE_CAPTION).blur()
    cy.getEditor().then((editor) => {
      const html = editor.getHTML()
      expect(html).to.contain('<figure')
      expect(html).to.contain('Round trip')
      editor.commands.setContent(html)
    })
    cy.nodeAttr('image', 'caption').should('eq', 'Round trip')
  })

  it('persists the caption through a JSON (collab) round-trip', () => {
    openImageCaption()
    cy.get(IMAGE_CAPTION).type('Persisted in JSON')
    cy.get(IMAGE_CAPTION).blur()
    cy.getEditor().then((editor) => {
      editor.commands.setContent(editor.getJSON())
    })
    cy.nodeAttr('image', 'caption').should('eq', 'Persisted in JSON')
  })

  it('renders the stored caption in the node view on load', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setContent(
        '<figure data-hm-figure><img src="https://example.com/photo.png" width="480" height="320"><figcaption>Loaded caption</figcaption></figure>'
      )
    })
    cy.get(IMAGE_CAPTION).should('have.text', 'Loaded caption')
  })

  it('emits a bare <img> (no figure) when caption is empty', () => {
    cy.getEditor().then((editor) => {
      expect(editor.getHTML()).to.not.contain('data-hm-figure')
    })
  })
})

describe('embed caption', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.getEditor().then((editor) => {
      editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    cy.get('#editor .hypermultimedia--youtube__content').trigger('mouseover', { force: true })
  })

  it('persists a caption via the node attribute + JSON round-trip, never serializing <figure>', () => {
    cy.get('#editor .media-toolbar [data-action-id="caption"]').click()
    cy.get('#editor .hypermultimedia--youtube__content .hm-caption').type('Embed caption')
    cy.get('#editor .hypermultimedia--youtube__content .hm-caption').blur()
    cy.nodeAttr('youtube', 'caption').should('eq', 'Embed caption')
    cy.getEditor().then((editor) => {
      editor.commands.setContent(editor.getJSON())
    })
    cy.nodeAttr('youtube', 'caption').should('eq', 'Embed caption')
    // embeds intentionally do not serialize the caption to standalone HTML
    cy.getEditor().then((editor) => {
      expect(editor.getHTML()).to.not.contain('data-hm-figure')
    })
  })

  it('Backspace while editing an embed caption keeps the embed node', () => {
    cy.get('#editor .media-toolbar [data-action-id="caption"]').click()
    cy.get('#editor .hypermultimedia--youtube__content .hm-caption').type('Embed{backspace}')
    cy.nodeCount('youtube').should('eq', 1)
    cy.get('#editor .hypermultimedia--youtube__content .hm-caption').should('have.text', 'Embe')
  })
})
