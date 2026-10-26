/**
 * Needs the whole local stack up (`make dev-local`): webapp, WS, REST, Supabase.
 * Local-only: no CI lane runs e2e/document/**. Run it with
 * `--config baseUrl=http://localhost:3000` (or wherever the webapp is).
 */

import { BASE, freshSlug, pad } from '../../support/documentStack'

const PREVIEW_EDIT = '.hyperlink-preview-popover button.edit'
const EDIT_POPOVER = '[data-testid="hyperlink-edit-popover"]'
const EDIT_TEXT = `${EDIT_POPOVER} [data-testid="hyperlink-editor-text"]`

// ProseMirror's click handler ignores Cypress clicks, so dispatch a native one on the text.
const clickLink = (href: string) =>
  cy.get(`.ProseMirror a[href="${href}"] > span:not(.hyperlink-icon)`).then(($text) => {
    const el = $text[0]
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

const expectPrefill = (href: string, text: string) => {
  clickLink(href)
  cy.get(PREVIEW_EDIT).should('be.visible').click()
  cy.get(EDIT_TEXT).should('have.value', text)
  cy.get(EDIT_TEXT).type('{esc}')
  cy.get(EDIT_POPOVER).should('not.exist')
}

describe('hyperlink link icon Edit prefill (full stack)', () => {
  let slug: string

  beforeEach(() => {
    slug = freshSlug('link-icon')
    cy.viewport(1280, 800)
    cy.intercept(
      { method: 'GET', pathname: '/api/metadata/icon' },
      { fixture: 'link-icon-16.png', headers: { 'content-type': 'image/png' } }
    )
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('fills the desktop Edit form with the link text only', () => {
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible').click()
    cy.realPress('Enter')
    cy.realType('[GitHub](https://github.com) and mailto:user@example.com ')

    cy.get('.ProseMirror a[href="https://github.com"] .hyperlink-icon').should('have.length', 1)
    cy.get('.ProseMirror a[href="mailto:user@example.com"] .hyperlink-icon').should(
      'have.length',
      1
    )

    expectPrefill('https://github.com', 'GitHub')
    expectPrefill('mailto:user@example.com', 'mailto:user@example.com')
  })
})
