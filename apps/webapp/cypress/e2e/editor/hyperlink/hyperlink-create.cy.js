/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const PARAGRAPH_TEXT = 'Select this target word to apply a hyperlink.'
const TARGET_TEXT = 'target'

const POPOVER = '[data-testid="hyperlink-create-popover"]'
const URL_INPUT = `${POPOVER} [data-testid="hyperlink-editor-url"]`
const SUBMIT_BTN = `${POPOVER} [data-testid="hyperlink-editor-submit"]`
const ERROR_MSG = `${POPOVER} [data-testid="hyperlink-editor-error"]`
const EDITOR_LINK = '.docy_editor a'
const PM = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Hyperlink Create', [paragraph(PARAGRAPH_TEXT)])]
}

const selectTarget = () => {
  cy.window().then((win) => {
    const editor = win._editor
    let from, to
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.includes(TARGET_TEXT)) {
        const offset = node.text.indexOf(TARGET_TEXT)
        from = pos + offset
        to = from + TARGET_TEXT.length
      }
    })
    if (from !== undefined && to !== undefined) {
      editor.chain().focus().setTextSelection({ from, to }).run()
    }
  })
}

describe('Hyperlink Create Popover', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-create' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('popover trigger', () => {
    it('opens create popover via Mod+K shortcut', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(POPOVER).should('be.visible')
      cy.get(URL_INPUT).should('be.visible')
    })

    it('opens create popover via toolbar button', () => {
      selectTarget()
      cy.get('[data-testid="toolbar-hyperlink"]').click()

      cy.get(POPOVER).should('be.visible')
      cy.get(URL_INPUT).should('be.visible')
    })
  })

  describe('Apply button state', () => {
    it('Apply button is disabled when URL input is empty', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(SUBMIT_BTN).should('be.disabled')
    })

    it('Apply button enables when URL is entered', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('https://example.com')
      cy.get(SUBMIT_BTN).should('not.be.disabled')
    })
  })

  describe('URL submission', () => {
    it('submitting a valid URL creates a hyperlink', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('https://example.com')
      cy.get(SUBMIT_BTN).click()

      cy.get(POPOVER).should('not.exist')
      cy.get(EDITOR_LINK)
        .contains(TARGET_TEXT)
        .should('have.attr', 'href')
        .and('include', 'https://example.com')
    })

    it('submitting an invalid URL shows error message', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('not a valid url')
      cy.get(SUBMIT_BTN).click()

      cy.get(ERROR_MSG).should('be.visible')
      cy.get(EDITOR_LINK).should('not.exist')
    })

    it('error clears when user types after failed validation', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('bad')
      cy.get(SUBMIT_BTN).click()
      cy.get(ERROR_MSG).should('be.visible')

      cy.get(URL_INPUT).clear().type('https://example.com')
      cy.get(ERROR_MSG).should('not.exist')
    })
  })

  describe('popover dismiss', () => {
    it('Escape on input dismisses popover without applying', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('https://partial.com')
      cy.get(URL_INPUT).realPress('Escape')

      cy.get(POPOVER).should('not.exist')
      cy.get(EDITOR_LINK).should('not.exist')
    })

    it('clicking outside popover dismisses it', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])
      cy.get(POPOVER).should('be.visible')

      // Wait for the outside-click listener to be registered (50ms defer + rAF)
      cy.wait(200)

      // Dispatch a native mousedown on the editor (outside the floating toolbar)
      cy.get(PM).then(($el) => {
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        $el[0].dispatchEvent(event)
      })

      cy.get(POPOVER).should('not.exist')
    })
  })

  describe('URL normalization', () => {
    it('normalizes bare domain URLs by prepending https://', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('example.com')
      cy.get(SUBMIT_BTN).click()

      // Picker editor canonicalizes via `normalizeHref` (https-prefix rule).
      cy.get(EDITOR_LINK)
        .contains(TARGET_TEXT)
        .should('have.attr', 'href')
        .and('eq', 'https://example.com')
    })

    it('preserves explicit http://', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('http://example.com')
      cy.get(SUBMIT_BTN).click()

      cy.get(EDITOR_LINK)
        .contains(TARGET_TEXT)
        .should('have.attr', 'href')
        .and('eq', 'http://example.com')
    })

    it('preserves explicit https://', () => {
      selectTarget()
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type('https://example.com/path')
      cy.get(SUBMIT_BTN).click()

      cy.get(EDITOR_LINK)
        .contains(TARGET_TEXT)
        .should('have.attr', 'href')
        .and('eq', 'https://example.com/path')
    })
  })
})
