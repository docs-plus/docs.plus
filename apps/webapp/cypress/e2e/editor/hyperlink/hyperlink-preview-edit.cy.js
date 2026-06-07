/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const LINK_TEXT = 'example link'
const LINK_HREF = 'https://example.com/page'
const PARAGRAPH_TEXT = 'Click the example link to test preview.'

const PREVIEW_POPOVER = '.hyperlink-preview-popover'
const EDIT_POPOVER = '[data-testid="hyperlink-edit-popover"]'
const EDIT_TEXT_INPUT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-text"]`
const EDIT_URL_INPUT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-url"]`
const EDIT_SUBMIT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-submit"]`
const EDIT_BACK = `${EDIT_POPOVER} [data-testid="hyperlink-editor-back"]`
const EDIT_ERROR = `${EDIT_POPOVER} [data-testid="hyperlink-editor-error"]`
const EDITOR_LINK = '.docy_editor a'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Preview Section', [paragraph(PARAGRAPH_TEXT)])]
}

const insertHyperlink = () => {
  cy.window().then((win) => {
    const editor = win._editor
    let from, to
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.includes(LINK_TEXT)) {
        const offset = node.text.indexOf(LINK_TEXT)
        from = pos + offset
        to = from + LINK_TEXT.length
      }
    })
    if (from !== undefined && to !== undefined) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setMark('hyperlink', { href: LINK_HREF })
        .run()
    }
  })
}

const clickLink = () => {
  cy.get(EDITOR_LINK)
    .contains(LINK_TEXT)
    .should('be.visible')
    .then(($el) => {
      const el = $el[0]
      const rect = el.getBoundingClientRect()
      el.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 0,
          view: el.ownerDocument.defaultView
        })
      )
    })
  cy.wait(500)
}

describe('Hyperlink Preview and Edit Popovers', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('mismatched transaction')) return false
    })
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-preview' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
    insertHyperlink()
    cy.get(EDITOR_LINK).should('exist')
  })

  describe('preview popover', () => {
    it('clicking a link shows preview popover', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')
    })

    it('preview displays the link URL', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')
      cy.get(`${PREVIEW_POPOVER} a`).should('exist')
    })

    it('remove button unsets the hyperlink', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')

      cy.get(`${PREVIEW_POPOVER} button.remove`).click()

      cy.get(PREVIEW_POPOVER).should('not.exist')
      cy.get(EDITOR_LINK).should('not.exist')
      cy.get('.docy_editor').should('contain.text', LINK_TEXT)
    })

    it('copy button copies href to clipboard', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')

      cy.get(`${PREVIEW_POPOVER} button.copy`).click()

      cy.window().then((win) => {
        win.navigator.clipboard.readText().then((text) => {
          expect(text).to.include('example.com')
        })
      })
    })
  })

  describe('edit popover', () => {
    it('edit button opens edit popover', () => {
      clickLink()
      cy.get(PREVIEW_POPOVER).should('be.visible')

      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')
    })

    it('edit popover pre-fills text and URL', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()

      cy.get(EDIT_POPOVER).should('be.visible')
      cy.get(EDIT_TEXT_INPUT).should('have.value', LINK_TEXT)
      cy.get(EDIT_URL_INPUT).invoke('val').should('include', 'example.com')
    })

    it('editing text updates the link text in the editor', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_TEXT_INPUT).clear().type('updated text')
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDITOR_LINK).should('contain.text', 'updated text')
    })

    it('editing URL updates the href', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_URL_INPUT).clear().type('https://updated.com/new')
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('include', 'https://updated.com/new')
    })

    it('edit with invalid URL shows error', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_URL_INPUT).clear().type('not valid')
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDIT_ERROR).should('be.visible')
    })

    // Note: the picker editor treats empty Text as "URL-only edit" — the
    // anchor's existing text is preserved (no error shown). The previous
    // "empty text shows error" test asserted behaviour from the old
    // edit popover and is intentionally retired with the migration.
    it('clearing text leaves the existing link text intact', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_TEXT_INPUT).clear()
      cy.get(EDIT_SUBMIT).click()

      cy.get(EDITOR_LINK).should('contain.text', LINK_TEXT)
    })

    it('Back button returns to preview popover', () => {
      clickLink()
      cy.get(`${PREVIEW_POPOVER} button.edit`).click()
      cy.get(EDIT_POPOVER).should('be.visible')

      cy.get(EDIT_BACK).click()

      cy.get(PREVIEW_POPOVER).should('be.visible')
    })
  })
})
