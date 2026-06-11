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
    cy.setEditorContent('<p>Outline your document here.</p>')
    cy.setCaretInText('Outline', 0)
    cy.pressKey('Tab')
    cy.getEditor().should((e) => expect(e.getText()).to.match(/^ {2}Outline/))
  })

  for (const theme of ['light', 'dark'] as const) {
    it(`captures Tab indent (${theme} theme)`, () => {
      setPlaygroundTheme(theme)
      cy.screenshot(`preview-${theme}`, readmeGalleryShotOpts)
    })
  }
})

export {}
