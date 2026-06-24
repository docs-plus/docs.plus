/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

/** Fixture URLs aligned with extension-hypermultimedia paste-matrix / markdown-round-trip. */
const FIXTURES = {
  image: 'https://example.com/photo.png',
  audio: 'https://example.com/track.mp3',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
}

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

function focusEndOfFirstParagraph() {
  cy.get('.docy_editor > .tiptap.ProseMirror > p').first().click()
  cy.get('.docy_editor > .tiptap.ProseMirror').realPress('End')
  cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Enter')
}

function pasteReplacingDocument(markdown) {
  cy.window().then((win) => {
    const editor = win._editor
    if (!editor) throw new Error('_editor missing')
    editor.chain().focus().selectAll().run()
  })
  cy.pasteAsPlainText(markdown)
  cy.wait(300)
}

describe('Markdown — hypermultimedia integration', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'md-media-test' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('parseMarkdown API (full pad stack)', () => {
    it('imports ![youtube](url) as a youtube node via setMarkdown', () => {
      cy.setMarkdown(`![youtube](${FIXTURES.youtube})`)
      cy.nodeCount('youtube').should('eq', 1)
      cy.nodeCount('image').should('eq', 0)
      cy.get('.docy_editor a').should('not.exist')
    })

    it('round-trips typed youtube markdown through getMarkdown', () => {
      cy.setMarkdown(`![youtube](${FIXTURES.youtube})`)
      cy.getMarkdown().then((exported) => {
        expect(exported).to.include('![youtube]')
        expect(exported).to.include(FIXTURES.youtube)
      })
    })

    it('round-trips ![audio](url width height) with dimensions', () => {
      cy.setMarkdown(`![audio](${FIXTURES.audio} width=400 height=80)`)
      cy.nodeCount('audio').should('eq', 1)
      cy.getMarkdown().then((exported) => {
        expect(exported).to.include(FIXTURES.audio)
        expect(exported).to.include('width=400')
        expect(exported).to.include('height=80')
      })
    })

    it('routes reserved ![youtube] alt away from plain image nodes', () => {
      cy.setMarkdown(`![youtube](${FIXTURES.youtube})`)
      cy.nodeCount('youtube').should('eq', 1)
      cy.nodeCount('image').should('eq', 0)
    })
  })

  describe('paste heuristic → embed nodes', () => {
    it('pastes a full document with ![youtube](url) as a youtube embed', () => {
      const markdown = [
        `# ${TEST_TITLE.short}`,
        '',
        `![youtube](${FIXTURES.youtube})`,
        '',
        'After the embed.'
      ].join('\n')

      pasteReplacingDocument(markdown)

      cy.nodeCount('youtube').should('eq', 1)
    })

    it('pastes a full document with GFM image syntax as an image node', () => {
      const markdown = [`# ${TEST_TITLE.short}`, '', `![Alt text](${FIXTURES.image})`].join('\n')

      pasteReplacingDocument(markdown)

      cy.nodeCount('image').should('eq', 1)
    })

    it('pastes YouTube URL as hyperlink when wrapped in link syntax', () => {
      focusEndOfFirstParagraph()

      const markdown = ['## Links', '', `[Watch on YouTube](${FIXTURES.youtube})`].join('\n')

      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.nodeCount('youtube').should('eq', 0)
      cy.get(`.docy_editor a[href="${FIXTURES.youtube}"]`).should(
        'contain.text',
        'Watch on YouTube'
      )
    })

    it('exports pasted typed youtube markdown via getMarkdown', () => {
      const markdown = [`# ${TEST_TITLE.short}`, '', `![youtube](${FIXTURES.youtube})`].join('\n')

      pasteReplacingDocument(markdown)

      cy.nodeCount('youtube').should('eq', 1)
      cy.getMarkdown().then((exported) => {
        expect(exported).to.include('![youtube]')
        expect(exported).to.include(FIXTURES.youtube)
      })
    })
  })

  describe('plain URL paste (hypermultimedia paste rules, not markdown)', () => {
    it('pastes a bare YouTube watch URL as an embed via extension paste handlers', () => {
      focusEndOfFirstParagraph()

      cy.pasteAsPlainText(FIXTURES.youtube)
      cy.wait(300)

      cy.nodeCount('youtube').should('eq', 1)
    })
  })
})
