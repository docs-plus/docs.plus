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

export {}
