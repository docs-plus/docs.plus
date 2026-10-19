/* eslint-disable no-undef */
import { freshSlug, padParagraph, sectionsDoc, visitSeededPad } from './filter-shared'

describe('Document filter (desktop)', () => {
  let slug

  beforeEach(() => {
    slug = freshSlug('filter-desktop')
    visitSeededPad(
      slug,
      sectionsDoc('Filter Doc', [
        ['Apple', 'apple pie body'],
        ['Banana', 'banana split body']
      ])
    )
    cy.waitForToc()
  })

  afterEach(() => {
    cy.task('deleteDocBySlug', slug)
  })

  it('does not crash when the query contains regex metacharacters', () => {
    cy.get('[aria-label="Filter document"]').first().click({ force: true })
    // A lone "(" / "[" used to construct `new RegExp(userInput)` and throw;
    // with no ErrorBoundary that throw would surface as an uncaught exception
    // and fail this test. Panel still mounted => substring match, no crash.
    cy.get('#filterSearchBox').type('(')
    cy.get('#filterSearchBox').type('a)[')
    cy.get('#filterSearchBox').should('exist')
    cy.get('[data-testid="filter-match-count"]').should('exist')
  })

  it('folds non-matching sections on apply and restores them on clear, without a full reload', () => {
    cy.window().then((w) => {
      w.__noReload = true
    })

    cy.get('[aria-label="Filter document"]').first().click({ force: true })
    cy.get('#filterSearchBox').type('apple{enter}')

    cy.location('pathname').should('include', 'apple') // path-segment URL model
    cy.get('.heading-fold-hidden', { timeout: 8000 }).should('exist')
    padParagraph('banana split body').should('not.be.visible')
    cy.window().its('__noReload').should('eq', true) // SPA push, never a full reload
    cy.get('[data-testid="filter-active-indicator"]').should('exist') // toolbar shows active state

    // Reset restores the folded section in place (the chip-row clear-all). The desktop
    // panel stays open after Enter, so a second trigger click would close it.
    cy.contains('button', 'Reset').click({ force: true })
    padParagraph('banana split body').should('be.visible')
    cy.get('[data-testid="filter-active-indicator"]').should('not.exist') // indicator cleared
    cy.window().its('__noReload').should('eq', true)
  })
})
