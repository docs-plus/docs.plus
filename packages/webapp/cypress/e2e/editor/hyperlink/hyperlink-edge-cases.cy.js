/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const PARAGRAPH_TEXT = 'First word and last word in this paragraph for edge testing.'

const POPOVER = '.hyperlink-create-popover'
const PREVIEW_POPOVER = '.hyperlink-preview-popover'
const URL_INPUT = `${POPOVER} input[name="hyperlink-url"]`
const SUBMIT_BTN = `${POPOVER} button[type="submit"]`
const EDITOR_LINK = '.docy_editor a'
const PM = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Edge Section', [paragraph(PARAGRAPH_TEXT)])]
}

const selectTextInEditor = (text) => {
  cy.window().then((win) => {
    const editor = win._editor
    let from, to
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.includes(text)) {
        const offset = node.text.indexOf(text)
        from = pos + offset
        to = from + text.length
      }
    })
    if (from !== undefined && to !== undefined) {
      editor.chain().focus().setTextSelection({ from, to }).run()
    }
  })
}

const applyLink = (text, url) => {
  selectTextInEditor(text)
  cy.get('.docy_editor').realPress(['Meta', 'k'])
  cy.get(URL_INPUT).type(url)
  cy.get(SUBMIT_BTN).click()
  cy.get(POPOVER).should('not.exist')
}

describe('Hyperlink Edge Cases', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-edge-cases' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('popover dismiss', () => {
    it('Escape on floating toolbar dismisses preview popover', () => {
      applyLink('First', 'https://example.com')

      // Native click required to trigger ProseMirror's handleDOMEvents.click
      cy.get(EDITOR_LINK)
        .first()
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
      cy.get(PREVIEW_POPOVER).should('be.visible')

      // Dispatch Escape on the popover itself (keydown listener is on .floating-popover)
      cy.get('.floating-popover').then(($toolbar) => {
        $toolbar[0].dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        )
      })

      cy.get(PREVIEW_POPOVER).should('not.exist')
    })

    it('Tab traps focus within create popover', () => {
      selectTextInEditor('First')
      cy.get('.docy_editor').realPress(['Meta', 'k'])
      cy.get(POPOVER).should('be.visible')

      cy.get(URL_INPUT).should('exist')
      cy.get(URL_INPUT).type('https://test.com')
      cy.get(URL_INPUT).realPress('Tab')

      cy.get(SUBMIT_BTN).should('exist')
    })
  })

  describe('undo', () => {
    it('programmatic setMark then undo removes the link', () => {
      // Use direct programmatic mark application for reliable undo
      selectTextInEditor('First')
      cy.window().then((win) => {
        const editor = win._editor
        editor.chain().focus().setMark('hyperlink', { href: 'https://example.com' }).run()
      })
      cy.get(EDITOR_LINK).should('exist')

      cy.window().then((win) => {
        win._editor.commands.undo()
      })

      cy.get(EDITOR_LINK).should('not.exist')
      cy.get('.docy_editor').should('contain.text', 'First')
    })
  })

  describe('multiple links', () => {
    it('creates two separate links in the same paragraph', () => {
      applyLink('First', 'https://first.com')
      cy.get(EDITOR_LINK).should('have.length', 1)

      applyLink('last', 'https://last.com')

      cy.get(EDITOR_LINK).should('have.length', 2)
      cy.get(`${EDITOR_LINK}[href="https://first.com"]`).should('contain.text', 'First')
      cy.get(`${EDITOR_LINK}[href="https://last.com"]`).should('contain.text', 'last')
    })
  })

  describe('boundary positions', () => {
    it('creates a link at the very start of a paragraph', () => {
      applyLink('First', 'https://start.com')

      cy.get(EDITOR_LINK)
        .should('contain.text', 'First')
        .and('have.attr', 'href', 'https://start.com')
    })

    it('creates a link at the very end of a paragraph', () => {
      applyLink('testing.', 'https://end.com')

      cy.get(EDITOR_LINK)
        .should('contain.text', 'testing.')
        .and('have.attr', 'href', 'https://end.com')
    })
  })

  describe('link replacement', () => {
    it('applying a new URL on existing link text replaces the href', () => {
      applyLink('First', 'https://original.com')

      cy.get(EDITOR_LINK).should('have.attr', 'href', 'https://original.com')

      applyLink('First', 'https://replaced.com')

      cy.get(EDITOR_LINK).contains('First').should('have.attr', 'href', 'https://replaced.com')
    })
  })

  describe('long URLs', () => {
    it('handles a very long URL without breaking the popover', () => {
      const longPath = 'a'.repeat(500)
      const longUrl = `https://example.com/${longPath}`

      selectTextInEditor('First')
      cy.get('.docy_editor').realPress(['Meta', 'k'])

      cy.get(URL_INPUT).type(longUrl, { delay: 0 })
      cy.get(SUBMIT_BTN).should('not.be.disabled')
      cy.get(SUBMIT_BTN).click()

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('include', 'example.com')
    })
  })

  describe('programmatic commands', () => {
    it('unsetHyperlink removes the mark programmatically', () => {
      applyLink('First', 'https://example.com')
      cy.get(EDITOR_LINK).should('exist')

      cy.window().then((win) => {
        const editor = win._editor
        let from
        editor.state.doc.descendants((node, pos) => {
          if (node.isText && node.text.includes('First')) {
            from = pos
          }
        })
        editor
          .chain()
          .focus()
          .setTextSelection(from + 1)
          .extendMarkRange('hyperlink')
          .unsetHyperlink()
          .run()
      })

      cy.get(EDITOR_LINK).should('not.exist')
    })
  })
})
