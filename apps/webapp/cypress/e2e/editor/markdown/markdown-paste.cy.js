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

      cy.window().then((win) => {
        const marks = []
        win._editor.state.doc.descendants((node) => {
          node.marks.forEach((m) => marks.push(m.type.name))
        })
        expect(marks).to.include('hyperlink')
        expect(marks).to.not.include('link')
      })
    })

    it('detects standalone GFM tables', () => {
      focusEndOfFirstParagraph()

      const markdown = ['| Col A | Col B |', '| --- | --- |', '| One | Two |'].join('\n')
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor table th').should('have.length', 2)
      cy.get('.docy_editor table td').should('have.length', 2)
    })

    it('detects standalone task lists', () => {
      focusEndOfFirstParagraph()

      const markdown = ['- [ ] Todo item', '- [x] Done item'].join('\n')
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor ul[data-type="taskList"] li').should('have.length', 2)
      cy.get('.docy_editor ul[data-type="taskList"] li[data-checked="true"]').should(
        'have.length',
        1
      )
    })

    it('detects multi-heading Markdown pastes', () => {
      focusEndOfFirstParagraph()

      const markdown = '# Section One\n\n## Section Two'
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor h1').should('contain.text', 'Section One')
      cy.get('.docy_editor h2').should('contain.text', 'Section Two')
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

    it('does not trigger for a lone heading (weight=5, below threshold)', () => {
      focusEndOfFirstParagraph()

      // Bold cannot prove this: Tiptap's own bold paste rule converts `**x**`
      // whether or not the Markdown plugin runs. Heading has no paste rule, so
      // a surviving literal `##` is proof the plugin declined.
      cy.pasteAsPlainText('## Not enough signal')
      cy.wait(300)

      cy.get('.docy_editor h2').should('not.exist')
      cy.get('.docy_editor').should('contain.text', '## Not enough signal')
    })

    it('does not trigger for terminal YAML with a document separator', () => {
      focusEndOfFirstParagraph()

      // `listItem` plus `thematicBreak` must stay under THRESHOLD. At a rule
      // weight of 3 this pasted as lists and an <hr>, and `Best,\nName\n---`
      // became a setext <h2> that the flat schema then gave a data-toc-id.
      cy.pasteAsPlainText('- name: web\n- name: db\n\n---\n\n- name: cache')
      cy.wait(300)

      cy.get('.docy_editor ul').should('not.exist')
      cy.get('.docy_editor hr').should('not.exist')
      cy.get('.docy_editor').should('contain.text', '- name: web')
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

      // `cy.get` fails before the assertion when no h2 exists, so assert absence.
      cy.get('.docy_editor h2').should('not.exist')
      cy.get('.docy_editor').should('contain.text', '## Heading from VS Code')
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
        '![svg](data:image/svg+xml;base64,PHN2Zy8+)',
        '',
        '![img](data:image/png;base64,abc123)'
      ].join('\n')
      cy.pasteAsPlainText(markdown)
      cy.wait(300)

      cy.get('.docy_editor a[href*="data:text"]').should('not.exist')
      cy.get('.docy_editor img[src*="data:image/svg+xml"]').should('not.exist')
      cy.get('.docy_editor img[src^="data:image/png"]').should('exist')
    })

    it('handles oversized clipboard gracefully (no parse attempt)', () => {
      focusEndOfFirstParagraph()

      const bigMarkdown = '## Big\n\n' + '- item\n'.repeat(100_000)
      cy.pasteAsPlainText(bigMarkdown)
      cy.wait(500)

      cy.get('.docy_editor').should('exist')
      cy.get('.docy_editor h2').should('not.exist')
    })
  })

  describe('full-document Markdown paste', () => {
    const cases = [
      {
        name: 'paragraph-first Markdown',
        md: 'Document Title\n\n## Sub Heading\n\n**Bold body**',
        assertBody: () => {
          cy.get(`${EDITOR_SEL} > h1`).should('contain.text', 'Document Title')
          cy.get('.docy_editor h2').should('contain.text', 'Sub Heading')
        }
      },
      {
        name: 'fenced-code-first Markdown',
        md: '```js\nconst n = 1\n```',
        assertBody: () => {
          cy.get(`${EDITOR_SEL} > :first-child`).should('match', 'h1')
          cy.get('.docy_editor pre code').should('contain.text', 'const n = 1')
        }
      },
      {
        name: 'table-first Markdown',
        md: '| A | B |\n| --- | --- |\n| 1 | 2 |',
        assertBody: () => {
          cy.get(`${EDITOR_SEL} > :first-child`).should('match', 'h1')
          cy.get('.docy_editor table td').should('have.length', 2)
        }
      },
      {
        name: 'task-list-first Markdown',
        md: '- [ ] First\n- [x] Second',
        assertBody: () => {
          cy.get(`${EDITOR_SEL} > :first-child`).should('match', 'h1')
          cy.get('.docy_editor ul[data-type="taskList"] li').should('have.length', 2)
        }
      },
      {
        name: 'lone-image with bold Markdown',
        md: '![Alt](https://example.com/a.png)\n\n**Caption**',
        assertBody: () => {
          cy.get(`${EDITOR_SEL} > :first-child`).should('match', 'h1')
          cy.get('.docy_editor img[src="https://example.com/a.png"]').should('exist')
        }
      }
    ]

    cases.forEach(({ name, md, assertBody }) => {
      it(`keeps TitleDocument valid when pasting ${name} over select-all`, () => {
        cy.get(EDITOR_SEL).click()
        cy.window().then((win) => {
          win._editor.commands.selectAll()
        })
        cy.pasteAsPlainText(md)
        cy.wait(300)

        assertBody()
        cy.window().then((win) => {
          expect(() => win._editor.state.doc.check()).to.not.throw()
        })
      })
    })
  })
})
