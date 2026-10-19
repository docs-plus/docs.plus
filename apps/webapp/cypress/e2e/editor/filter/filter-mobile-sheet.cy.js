/* eslint-disable no-undef */
import { freshSlug, IPHONE_UA, sectionsDoc, visitSeededPad } from './filter-shared'

describe('Document filter (mobile sheet)', () => {
  let slug

  beforeEach(() => {
    slug = freshSlug('filter-mobile')
    cy.viewport('iphone-x')
    visitSeededPad(
      slug,
      sectionsDoc('Filter Doc', [
        ['Apple', 'apple pie body'],
        ['Banana', 'banana split body']
      ]),
      { userAgent: IPHONE_UA }
    )
    // A desktop render has none of the mobile controls, so fail here, not later.
    cy.get('html').should('have.class', 'm_mobile')
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('opens the unified filter sheet, shows a live match count, and applies in place', () => {
    cy.window().then((w) => {
      w.__noReload = true
    })

    // The filter button lives in the TOC drawer footer.
    cy.get('[aria-label^="Open menu"]').click()
    cy.get('[aria-label="Open filters"]').click()
    cy.get('[data-testid="filter-sheet-apply"]').should('be.visible')

    // Counter is driven by real headings, not the old dead `.title` selector.
    cy.get('#filterSearchBox').type('apple')
    cy.get('[data-testid="filter-match-count"]').should('contain', 'section')

    cy.get('[data-testid="filter-sheet-apply"]').click({ force: true })
    cy.location('pathname').should('match', /\/apple$/)
    cy.get('.heading-fold-hidden', { timeout: 8000 }).should('exist')
    cy.get('[data-testid="filter-sheet-apply"]').should('not.exist')
    cy.get('[aria-label="Remove filter: apple"]').should('exist')
    cy.window().its('__noReload').should('eq', true) // SPA push, no full reload
  })
})
