/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const EDITOR_SEL = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [{ type: 'paragraph', content: 'Some body content here.' }])]
}

function focusEndOfFirstParagraph() {
  cy.get(`${EDITOR_SEL} > p`).first().click()
  cy.get(EDITOR_SEL).realPress('End')
  cy.get(EDITOR_SEL).realPress('Enter')
}

describe('Markdown Export', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'md-export-test' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('getMarkdown() output', () => {
    it('exports document as Markdown string', () => {
      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.be.a('string')
        expect(md.length).to.be.greaterThan(0)
      })
    })

    it('includes heading and paragraph content', () => {
      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include(TEST_TITLE.short)
        expect(md).to.include('Some body content here.')
      })
    })

    it('serializes bold marks as **text**', () => {
      focusEndOfFirstParagraph()

      cy.get(EDITOR_SEL).realType('Some ')
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get(EDITOR_SEL).realType('bold')
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get(EDITOR_SEL).realType(' text')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('**bold**')
      })
    })

    it('serializes italic marks as *text*', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get(EDITOR_SEL).realType('italic')
      cy.get('.docy_editor').realPress(['Meta', 'i'])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('*italic*')
      })
    })

    it('serializes inline code as `code`', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'e'])
      cy.get(EDITOR_SEL).realType('myVar')
      cy.get('.docy_editor').realPress(['Meta', 'e'])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('`myVar`')
      })
    })

    it('serializes strikethrough as ~~text~~', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])
      cy.get(EDITOR_SEL).realType('deleted')
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 's'])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('~~deleted~~')
      })
    })
  })

  describe('list export', () => {
    it('exports bullet lists as - items', () => {
      focusEndOfFirstParagraph()

      cy.createBulletList([{ text: 'Alpha' }, { text: 'Beta' }])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.match(/[-*] Alpha/)
        expect(md).to.match(/[-*] Beta/)
      })
    })

    it('exports ordered lists as numbered items', () => {
      focusEndOfFirstParagraph()

      cy.createOrderedList([{ text: 'First' }, { text: 'Second' }])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.match(/\d+\.\s+First/)
        expect(md).to.match(/\d+\.\s+Second/)
      })
    })
  })

  describe('link export', () => {
    it('serializes hyperlinks as [text](url)', () => {
      focusEndOfFirstParagraph()

      cy.get(EDITOR_SEL).realType('Check ')
      cy.window().then((win) => {
        const editor = win._editor?.instance
        if (!editor) throw new Error('editor not found')
        editor.commands.insertContent({
          type: 'text',
          text: 'example',
          marks: [{ type: 'hyperlink', attrs: { href: 'https://example.com' } }]
        })
      })

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('[example](https://example.com)')
      })
    })
  })

  describe('highlight export', () => {
    it('serializes highlight as ==text==', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'Shift', 'h'])
      cy.get(EDITOR_SEL).realType('highlighted')
      cy.get('.docy_editor').realPress(['Meta', 'Shift', 'h'])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('==highlighted==')
      })
    })
  })

  describe('settings panel export button', () => {
    it('export button is enabled when document has content', () => {
      cy.get('[tooltip="Document Settings"]').click()
      cy.contains('Markdown').click()
      cy.contains('button', 'Export .md').should('not.be.disabled')
    })

    it('import button is enabled when editor is ready', () => {
      cy.get('[tooltip="Document Settings"]').click()
      cy.contains('Markdown').click()
      cy.contains('button', 'Import .md').should('not.be.disabled')
    })
  })
})
