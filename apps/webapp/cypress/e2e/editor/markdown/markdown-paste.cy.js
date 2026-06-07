/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const EDITOR_SEL = '.docy_editor > .tiptap.ProseMirror'

function focusEndOfFirstParagraph() {
  cy.get(`${EDITOR_SEL} > p`).first().click()
  cy.get(EDITOR_SEL).realPress('End')
  cy.get(EDITOR_SEL).realPress('Enter')
}

describe('Markdown Paste Detection', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'md-paste-test' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  describe('heuristic detection', () => {
    it('parses pasted Markdown with headings, bold, and links as rich content', () => {
      focusEndOfFirstParagraph()

      const markdown = [
        '## Sub Heading',
        '',
        'Some **bold text** and a [link](https://example.com).',
        '',
        '- Item one',
        '- Item two'
      ].join('\n')

      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor h2').should('contain.text', 'Sub Heading')
      cy.get('.docy_editor strong').should('contain.text', 'bold text')
      cy.get('.docy_editor a[href="https://example.com"]').should('contain.text', 'link')
      cy.get('.docy_editor ul li').should('have.length.at.least', 2)
    })

    it('does not trigger for plain text below heuristic threshold', () => {
      focusEndOfFirstParagraph()

      cy.pasteAsPlainText('Just a simple plain text paragraph without any markdown.')
      cy.wait(300)

      cy.get('.docy_editor h2').should('not.exist')
      cy.get('.docy_editor').should('contain.text', 'Just a simple plain text paragraph')
    })

    it('detects fenced code blocks alone (weight=10, above threshold)', () => {
      focusEndOfFirstParagraph()

      const markdown = '```js\nconsole.log("hello")\n```'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor pre code').should('exist')
    })

    it('detects blockquote + list combo (weight=3+3=6, at threshold)', () => {
      focusEndOfFirstParagraph()

      const markdown = '> This is a quote\n\n- And a list item'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor blockquote').should('contain.text', 'This is a quote')
      cy.get('.docy_editor ul li').should('have.length.at.least', 1)
    })

    it('does not trigger for a single bold word (weight=2, below threshold)', () => {
      focusEndOfFirstParagraph()

      cy.pasteAsPlainText('This has **one** bold word only.')
      cy.wait(300)

      cy.get('.docy_editor strong').should('not.exist')
      cy.get('.docy_editor').should('contain.text', '**one**')
    })
  })

  describe('clipboard precedence', () => {
    it('uses HTML path when text/html is present (non-shell)', () => {
      focusEndOfFirstParagraph()

      cy.pasteWithMimeTypes({
        'text/html': '<p>Rich <strong>HTML</strong> content</p>',
        'text/plain': '## Heading\n\n**bold**'
      })
      cy.wait(300)

      cy.get('.docy_editor').should('contain.text', 'Rich')
      cy.get('.docy_editor strong').should('contain.text', 'HTML')
    })

    it('bypasses VS Code clipboard and falls through to default paste', () => {
      focusEndOfFirstParagraph()

      cy.pasteWithMimeTypes({ 'text/plain': '## Heading from VS Code\n\n- list item\n- another' }, [
        'vscode-editor-data'
      ])
      cy.wait(300)

      cy.get('.docy_editor h2').should('not.contain.text', 'Heading from VS Code')
    })

    it('treats macOS shell HTML wrapper as plain text and detects markdown', () => {
      focusEndOfFirstParagraph()

      const markdown = '## Shell Heading\n\n- item one\n- item two'
      cy.pasteWithMimeTypes({
        'text/html': '<span style="color: #000">some wrapper text</span>',
        'text/plain': markdown
      })
      cy.wait(300)

      cy.get('.docy_editor h2').should('contain.text', 'Shell Heading')
      cy.get('.docy_editor ul li').should('have.length.at.least', 2)
    })

    it('treats multi-element HTML as real HTML, not shell wrapper', () => {
      focusEndOfFirstParagraph()

      cy.pasteWithMimeTypes({
        'text/html': '<p>Paragraph one</p><p>Paragraph two with <strong>bold</strong></p>',
        'text/plain': '## Heading\n\n**bold**'
      })
      cy.wait(300)

      cy.get('.docy_editor').should('contain.text', 'Paragraph one')
      cy.get('.docy_editor strong').should('contain.text', 'bold')
    })
  })

  describe('code block bypass', () => {
    it('inserts literal text when pasting inside a code block', () => {
      focusEndOfFirstParagraph()

      cy.get(EDITOR_SEL).realType('```')
      cy.get(EDITOR_SEL).realPress('Enter')

      const mdText = '## Heading\n\n**bold** and [link](https://example.com)'
      cy.pasteAsPlainText(mdText)
      cy.wait(300)

      cy.get('.docy_editor pre code').should('contain.text', '## Heading')
      cy.get('.docy_editor pre code').should('contain.text', '**bold**')
    })
  })

  describe('security sanitization', () => {
    it('strips javascript: protocol from pasted links', () => {
      focusEndOfFirstParagraph()

      const markdown =
        '## Test\n\n[click me](javascript:alert(1))\n\n[safe link](https://example.com)'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor a[href="https://example.com"]').should('exist')
      cy.get('.docy_editor a[href*="javascript"]').should('not.exist')
    })

    it('strips data: URIs except data:image/', () => {
      focusEndOfFirstParagraph()

      const markdown = [
        '## Links Test',
        '',
        '[xss](data:text/html,<script>alert(1)</script>)',
        '',
        '![img](data:image/png;base64,abc123)'
      ].join('\n')
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor a[href*="data:text"]').should('not.exist')
    })

    it('handles oversized clipboard gracefully (no parse attempt)', () => {
      focusEndOfFirstParagraph()

      const bigMarkdown = '## Big\n\n' + '- item\n'.repeat(100_000)
      cy.pasteAsPlainText(bigMarkdown)
      cy.wait(500)

      cy.get('.docy_editor').should('exist')
    })
  })
})
