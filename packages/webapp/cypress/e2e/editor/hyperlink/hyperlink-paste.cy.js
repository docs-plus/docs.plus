/* eslint-disable no-undef */

import { paragraph, section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const PARAGRAPH_TEXT = 'Select this text for paste testing.'
const TARGET_TEXT = 'this text'

const EDITOR_LINK = '.docy_editor a'
const PM = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section('Paste Section', [paragraph(PARAGRAPH_TEXT)])]
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

describe('Hyperlink Paste Behavior', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hyperlink-paste' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('paste rules (markPasteRule)', () => {
    it('pasting a bare URL as plain text creates a link via paste rule', () => {
      cy.get(PM).click()
      cy.window().then((win) => {
        const editor = win._editor
        const docSize = editor.state.doc.content.size
        editor.commands.focus(docSize - 1)
      })
      cy.get(PM).realType(' ')

      cy.pasteAsPlainText('https://example.com')
      cy.wait(300)

      cy.get(EDITOR_LINK)
        .should('have.attr', 'href', 'https://example.com')
        .and('contain.text', 'https://example.com')
    })

    it('pasting markdown [text](url) as plain text creates a link', () => {
      cy.get(PM).click()
      cy.window().then((win) => {
        const editor = win._editor
        const docSize = editor.state.doc.content.size
        editor.commands.focus(docSize - 1)
      })
      cy.get(PM).realType(' ')

      cy.pasteAsPlainText('[Google](https://google.com)')
      cy.wait(300)

      cy.get(EDITOR_LINK).should('have.attr', 'href').and('include', 'google.com')
    })
  })

  describe('linkOnPaste disabled', () => {
    it('with linkOnPaste off, pasting URL text still creates a link via markPasteRule', () => {
      // Position cursor at end of paragraph
      cy.get(PM).click()
      cy.window().then((win) => {
        const editor = win._editor
        const docSize = editor.state.doc.content.size
        editor.commands.focus(docSize - 1)
      })
      cy.get(PM).realType(' ')

      cy.pasteAsPlainText('https://pasted-url.com')
      cy.wait(300)

      // Even with linkOnPaste: false, markPasteRule auto-detects URLs in pasted text
      cy.get(EDITOR_LINK)
        .should('have.attr', 'href', 'https://pasted-url.com')
        .and('contain.text', 'https://pasted-url.com')
    })
  })

  describe('HTML paste', () => {
    it('pasting HTML with <a> preserves the link', () => {
      cy.get(PM).click()
      cy.window().then((win) => {
        const editor = win._editor
        const docSize = editor.state.doc.content.size
        editor.commands.focus(docSize - 1)
      })
      cy.get(PM).realType(' ')

      cy.pasteWithMimeTypes({
        'text/html': '<a href="https://preserved.com">preserved link</a>',
        'text/plain': 'preserved link'
      })
      cy.wait(300)

      cy.get(EDITOR_LINK)
        .should('have.attr', 'href', 'https://preserved.com')
        .and('contain.text', 'preserved link')
    })

    it('pasting HTML with javascript: href strips the link', () => {
      cy.get(PM).click()
      cy.window().then((win) => {
        const editor = win._editor
        const docSize = editor.state.doc.content.size
        editor.commands.focus(docSize - 1)
      })
      cy.get(PM).realType(' ')

      cy.pasteWithMimeTypes({
        'text/html': '<a href="javascript:alert(1)">malicious link</a>',
        'text/plain': 'malicious link'
      })
      cy.wait(300)

      cy.get(`${EDITOR_LINK}[href*="javascript"]`).should('not.exist')
    })

    it('pasting HTML with multiple links preserves all', () => {
      cy.get(PM).click()
      cy.window().then((win) => {
        const editor = win._editor
        const docSize = editor.state.doc.content.size
        editor.commands.focus(docSize - 1)
      })
      cy.get(PM).realType(' ')

      cy.pasteWithMimeTypes({
        'text/html':
          '<a href="https://first.com">first</a> and <a href="https://second.com">second</a>',
        'text/plain': 'first and second'
      })
      cy.wait(300)

      cy.get(EDITOR_LINK).should('have.length.at.least', 2)
      cy.get(`${EDITOR_LINK}[href="https://first.com"]`).should('contain.text', 'first')
      cy.get(`${EDITOR_LINK}[href="https://second.com"]`).should('contain.text', 'second')
    })
  })
})
