/// <reference types="cypress" />

/** README gallery — `bun run docs:screenshots`; skipped by release-gate `cypress/e2e/` runs. */

import {
  prepareReadmeGalleryViewport,
  readmeGalleryShotOpts,
  setPlaygroundTheme
} from '@docs.plus/playground/cypress/readmeGallery'

describe('README screenshot gallery', { testIsolation: false }, () => {
  beforeEach(() => {
    prepareReadmeGalleryViewport()
    cy.visitPlayground()
    cy.get('#editor [data-placeholder]').should(
      'have.attr',
      'data-placeholder',
      'Write something here'
    )
  })

  for (const theme of ['light', 'dark'] as const) {
    it(`captures empty-doc placeholder (${theme} theme)`, () => {
      setPlaygroundTheme(theme)
      cy.screenshot(`preview-${theme}`, readmeGalleryShotOpts)
    })
  }
})

export {}
