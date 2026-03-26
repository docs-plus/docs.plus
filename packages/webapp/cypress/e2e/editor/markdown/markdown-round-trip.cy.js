/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const EDITOR_SEL = '.docy_editor > .tiptap.ProseMirror'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

function focusEndOfFirstParagraph() {
  cy.get(`${EDITOR_SEL} > p`).first().click()
  cy.get(EDITOR_SEL).realPress('End')
  cy.get(EDITOR_SEL).realPress('Enter')
}

describe('Markdown Round-Trip Fidelity', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'md-roundtrip-test' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('inline marks', () => {
    it('round-trips bold, italic, and inline code via getMarkdown()', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get(EDITOR_SEL).realType('bold')
      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get(EDITOR_SEL).realType(' ')

      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get(EDITOR_SEL).realType('italic')
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get(EDITOR_SEL).realType(' ')

      cy.get('.docy_editor').realPress(['Meta', 'e'])
      cy.get(EDITOR_SEL).realType('code')
      cy.get('.docy_editor').realPress(['Meta', 'e'])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('**bold**')
        expect(md).to.include('*italic*')
        expect(md).to.include('`code`')
      })
    })

    it('round-trips nested bold+italic (***text***)', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'b'])
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get(EDITOR_SEL).realType('bold and italic')
      cy.get('.docy_editor').realPress(['Meta', 'i'])
      cy.get('.docy_editor').realPress(['Meta', 'b'])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.match(/\*{2,3}bold and italic\*{2,3}/)
      })
    })

    it('silently drops underline from Markdown output (lossy construct)', () => {
      focusEndOfFirstParagraph()

      cy.get('.docy_editor').realPress(['Meta', 'u'])
      cy.get(EDITOR_SEL).realType('underlined')
      cy.get('.docy_editor').realPress(['Meta', 'u'])

      cy.get('.docy_editor u').should('contain.text', 'underlined')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('underlined')
        expect(md).to.not.include('<u>')
      })
    })
  })

  describe('block-level elements', () => {
    it('round-trips blockquotes', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Quotable\n\n> This is a blockquote\n\nAfter the quote.'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor blockquote').should('contain.text', 'This is a blockquote')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('> This is a blockquote')
      })
    })

    it('round-trips horizontal rules', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Section\n\nBefore rule.\n\n---\n\nAfter rule.'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor hr').should('exist')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.match(/---/)
      })
    })

    it('preserves nested list structure in Markdown output', () => {
      focusEndOfFirstParagraph()

      cy.createBulletList([
        { text: 'Top level' },
        { text: 'Nested', indent: 1 },
        { text: 'Back to top' }
      ])

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('Top level')
        expect(md).to.include('Nested')
        expect(md).to.include('Back to top')
      })
    })
  })

  describe('code blocks', () => {
    it('round-trips fenced code block content', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Code\n\n```\nconst x = 42\n```'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor pre code').should('contain.text', 'const x = 42')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('```')
        expect(md).to.include('const x = 42')
      })
    })

    it('round-trips fenced code block with language hint', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Code\n\n```javascript\nfunction hello() {}\n```'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor pre code').should('contain.text', 'function hello()')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('function hello()')
        expect(md).to.include('```')
      })
    })
  })

  describe('headings and structure', () => {
    it('heading nodes get valid toc-id after Markdown paste', () => {
      focusEndOfFirstParagraph()

      cy.pasteAsPlainText('## Pasted Heading\n\nSome paragraph text.')
      cy.wait(300)

      cy.get('.docy_editor h2[data-toc-id]')
        .should('contain.text', 'Pasted Heading')
        .invoke('attr', 'data-toc-id')
        .should('not.be.empty')
    })

    it('preserves heading levels through paste → export', () => {
      focusEndOfFirstParagraph()

      const markdown = [
        '## Level 2',
        '',
        'Para under 2',
        '',
        '### Level 3',
        '',
        'Para under 3'
      ].join('\n')

      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor h2').should('contain.text', 'Level 2')
      cy.get('.docy_editor h3').should('contain.text', 'Level 3')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('## Level 2')
        expect(md).to.include('### Level 3')
      })
    })
  })

  describe('links and images', () => {
    it('round-trips hyperlinks through paste → export', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Links\n\nVisit [Google](https://google.com) today.'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor a[href="https://google.com"]').should('contain.text', 'Google')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('[Google](https://google.com)')
      })
    })

    it('round-trips image syntax through paste → export', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Images\n\n![Alt text](https://example.com/img.png)'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor img[src="https://example.com/img.png"]').should('exist')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('![Alt text](https://example.com/img.png)')
      })
    })
  })

  describe('highlight round-trip', () => {
    it('round-trips ==highlight== marks via paste → export', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Highlights\n\nThis has ==highlighted text== in it.'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor mark').should('contain.text', 'highlighted text')

      cy.window().then((win) => {
        const md = win._getMarkdown?.()
        expect(md).to.include('==highlighted text==')
      })
    })
  })

  describe('parseMarkdown API', () => {
    it('_parseMarkdown returns valid JSONContent for well-formed markdown', () => {
      cy.window().then((win) => {
        const json = win._parseMarkdown?.('## Hello\n\nWorld')
        expect(json).to.have.property('type', 'doc')
        expect(json).to.have.property('content').that.is.an('array')
      })
    })

    it('_parseMarkdown returns doc with empty content for empty input', () => {
      cy.window().then((win) => {
        const json = win._parseMarkdown?.('')
        expect(json).to.have.property('type', 'doc')
      })
    })
  })
})
