/// <reference types="cypress" />

const DANGEROUS = ['javascript:alert(1)', 'data:text/html,hi', 'vbscript:msgbox("x")']

describe('Markdown import/export — hyperlink mark', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  describe('full round-trip (setMarkdown → getMarkdown)', () => {
    it('round-trips a basic https link', () => {
      cy.setMarkdown('Visit [Example](https://example.com) today.')
      cy.get('#editor a[href="https://example.com"]').should('contain.text', 'Example')
      cy.getMarkdown().should('include', '[Example](https://example.com)')
    })

    it('re-imports exported markdown unchanged for a simple link', () => {
      const md = 'Visit [Example](https://example.com) today.'
      cy.setMarkdown(md)
      cy.getMarkdown().then((exported) => {
        expect(exported).to.include('[Example](https://example.com)')
        cy.setMarkdown(exported)
        cy.get('#editor a[href="https://example.com"]').should('contain.text', 'Example')
      })
    })

    it('canonicalizes bare email to mailto on import and export', () => {
      cy.setMarkdown('[Write us](user@example.com)')
      cy.get('#editor a[href="mailto:user@example.com"]').should('exist')
      cy.getMarkdown().should('include', 'mailto:user@example.com')
    })

    it('canonicalizes bare E.164 phone to tel on import and export', () => {
      cy.setMarkdown('[Call](+15551234567)')
      cy.get('#editor a[href="tel:+15551234567"]').should('exist')
      cy.getMarkdown().should('include', 'tel:+15551234567')
    })

    it('canonicalizes bare domains to https on import', () => {
      cy.setMarkdown('[Docs](example.com)')
      cy.get('#editor a[href="https://example.com"]').should('exist')
    })

    it('preserves bold inside link label through import and export', () => {
      cy.setMarkdown('[**Bold label**](https://example.com/label)')
      cy.get('#editor a strong').should('contain.text', 'Bold label')
      cy.getMarkdown().should('include', 'Bold label')
      cy.getMarkdown().should('include', 'https://example.com/label')
    })

    it('escapes ) in href on export', () => {
      cy.setEditorContent('<p><a href="https://example.com/path%29">safe label</a></p>')
      cy.getMarkdown().should('include', '%29')
    })
  })

  describe('parseMarkdown security', () => {
    DANGEROUS.forEach((href) => {
      it(`blanks href for [text](${href}) on markdown import`, () => {
        cy.setMarkdown(`[click](${href})`)
        cy.get('#editor a').should('have.attr', 'href', '')
      })
    })
  })

  describe('renderMarkdown security + escaping', () => {
    // Export is the last gate: a hostile mark can reach the doc without passing
    // parseHTML or parseMarkdown — Yjs replay, a foreign addMark, or a schema
    // migration — so insert the mark from JSON rather than from markup.
    DANGEROUS.forEach((href) => {
      it(`blanks ${href} on export when the mark bypassed the import gates`, () => {
        cy.getEditor().then((editor) => {
          editor.commands.insertContent({
            type: 'text',
            text: 'click',
            marks: [{ type: 'hyperlink', attrs: { href } }]
          })
        })
        cy.getMarkdown().should('include', '[click]()')
        cy.getMarkdown().should('not.include', href)
      })
    })

    // A mark contributes only the slices around `renderChildren()`, so the label
    // cannot be escaped from `renderMarkdown`. Balanced brackets need no escape;
    // pin that here so nobody re-adds a replace that would corrupt the
    // placeholder and blank the link syntax entirely.
    it('round-trips balanced brackets in the label without escaping', () => {
      cy.setEditorContent('<p><a href="https://example.com/x">a [b] c</a></p>')
      cy.getMarkdown().should('include', '[a [b] c](https://example.com/x)')
      cy.getMarkdown().then((md) => {
        cy.setMarkdown(md)
        cy.get('#editor a[href="https://example.com/x"]').should('have.text', 'a [b] c')
      })
    })

    it('keeps the link when the label holds an unbalanced bracket', () => {
      cy.setEditorContent('<p><a href="https://example.com/y">a [b c</a></p>')
      cy.getMarkdown().then((md) => {
        cy.setMarkdown(md)
        cy.get('#editor a[href="https://example.com/y"]').should('exist')
      })
    })

    it('percent-encodes whitespace in the href so marked keeps the link', () => {
      cy.getEditor().then((editor) => {
        editor.commands.insertContent({
          type: 'text',
          text: 'spaced',
          marks: [{ type: 'hyperlink', attrs: { href: 'https://example.com/a b' } }]
        })
      })
      cy.getMarkdown().should('include', '(https://example.com/a%20b)')
    })
  })

  describe('markdown input rule (typing)', () => {
    it('canonicalizes [email](user@example.com) typed inline', () => {
      cy.getEditor().then((editor) => {
        editor.commands.focus()
      })
      cy.realType('[Write us](user@example.com) ')
      cy.get('#editor a[href="mailto:user@example.com"]').should('exist')
    })
  })
})

describe('HTML round-trip — hyperlink mark', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>Visit example today.</p>')
    cy.selectText('example')
  })

  it('round-trips href and label through getHTML() → setContent()', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setHyperlink({ href: 'https://example.com' })
      editor.commands.setContent(editor.getHTML())
    })
    cy.get('#editor a[href="https://example.com"]').should('contain.text', 'example')
  })

  it('drops a stored target, so `_blank` cannot survive a copy/paste of the HTML', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setHyperlink({ href: 'https://example.com', target: '_blank' })
      const html = editor.getHTML()
      expect(html).to.include('href="https://example.com"')
      expect(html).to.not.include('target=')

      editor.commands.setContent(html)
      let found = false
      let target: unknown
      editor.state.doc.descendants((node) => {
        const mark = node.marks.find((m) => m.type.name === 'hyperlink')
        if (found || !mark) return
        found = true
        target = mark.attrs.target
      })
      expect(found, 'hyperlink mark survives HTML re-import').to.equal(true)
      expect(target, 'target falls back to the configured default').to.equal(null)
    })
  })
})

export {}
