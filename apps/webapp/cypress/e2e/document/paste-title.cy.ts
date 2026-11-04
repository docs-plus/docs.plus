/**
 * Needs the whole local stack up (`make dev-local`): webapp, WS, REST, Supabase.
 * Local-only: no CI lane runs e2e/document/**. Run it with
 * `--config baseUrl=http://localhost:3000` (or wherever the webapp is).
 */

import { BASE, freshSlug, pad } from '../../support/documentStack'

const MOD = Cypress.platform === 'darwin' ? 'Meta' : 'Control'
// Not a host name (the spoof rule) and not the URL, so the engine takes it.
const TITLE = 'Paste Title Fixture Page'
// Each `cy.visit` loads a new page, so the in-memory `fetchMetadata` cache starts empty.
const PASTED_URL = 'https://example.org/paste-title'
const LINK = `.ProseMirror a[href="${PASTED_URL}"]`

// The engine reads the real paste path, so dispatch a ClipboardEvent on the pad itself.
const pastePlainText = (text: string) =>
  pad().then(($pm) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    $pm[0].dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    )
  })

describe('paste title on a live pad (full stack)', () => {
  let slug: string

  beforeEach(() => {
    slug = freshSlug('paste-title')
    cy.viewport(1280, 800)
    // No delay: an instant title is the case where y-undo could merge it into the paste.
    cy.intercept(
      { method: 'GET', pathname: '/api/metadata' },
      { body: { success: true, url: PASTED_URL, title: TITLE } }
    ).as('metadata')
    cy.intercept(
      { method: 'GET', pathname: '/api/metadata/icon' },
      { fixture: 'link-icon-16.png', headers: { 'content-type': 'image/png' } }
    )
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('swaps a pasted URL for the page title; one undo restores the URL, a second removes it', () => {
    cy.visit(`${BASE}/${slug}`)
    pad().should('be.visible').click()
    cy.realPress('Enter')
    cy.realType('See ')
    pad().should('have.focus')

    pastePlainText(PASTED_URL)
    cy.wait('@metadata').its('request.url').should('include', encodeURIComponent(PASTED_URL))
    cy.get(LINK).should('contain.text', TITLE)

    pad().should('have.focus')
    cy.realPress([MOD, 'z'])
    cy.get(LINK).should('contain.text', PASTED_URL).and('not.contain.text', TITLE)

    pad().should('have.focus')
    cy.realPress([MOD, 'z'])
    cy.get(LINK).should('not.exist')
  })
})
