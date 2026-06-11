/// <reference types="cypress" />

/** README gallery — `bun run docs:screenshots`; skipped by release-gate `cypress/e2e/` runs. */

import {
  prepareReadmeGalleryViewport,
  readmeGalleryShotOpts,
  setPlaygroundTheme
} from '@docs.plus/playground/cypress/readmeGallery'

const CREATE = '.hyperlink-create-popover'
const PREVIEW = '.hyperlink-preview-popover'
const EDIT = '.hyperlink-edit-popover'
const CREATE_INPUT = `${CREATE} input[name="hyperlink-url"]`

const DOC_WITH_LINK = '<p>Visit <a href="https://docs.plus">docs.plus</a> for rich-text docs.</p>'

// Floating-popover transition (~120ms) — `be.visible` resolves at first paint.
const TRANSITION_SETTLE_MS = 250

describe('README screenshot gallery', { testIsolation: false }, () => {
  beforeEach(() => {
    prepareReadmeGalleryViewport()
    cy.visitPlayground()
  })

  for (const theme of ['light', 'dark'] as const) {
    it(`captures create popover (${theme} theme)`, () => {
      setPlaygroundTheme(theme)
      cy.setEditorContent('<p>Link to docs.plus in this sentence.</p>')
      cy.selectText('docs.plus')
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(CREATE).should('be.visible')
      cy.get(CREATE_INPUT).type('https://docs.plus')
      cy.wait(TRANSITION_SETTLE_MS)
      cy.screenshot(`create-${theme}`, readmeGalleryShotOpts)
    })

    it(`captures preview popover (${theme} theme)`, () => {
      setPlaygroundTheme(theme)
      cy.setEditorContent(DOC_WITH_LINK)
      cy.get('#editor a').click()
      cy.get(PREVIEW).should('be.visible')
      cy.wait(TRANSITION_SETTLE_MS)
      cy.screenshot(`preview-${theme}`, readmeGalleryShotOpts)
    })

    it(`captures edit popover (${theme} theme)`, () => {
      setPlaygroundTheme(theme)
      cy.setEditorContent(DOC_WITH_LINK)
      cy.get('#editor a').click()
      cy.get(PREVIEW).should('be.visible')
      cy.get(`${PREVIEW} .edit`).click()
      cy.get(EDIT).should('be.visible')
      cy.wait(TRANSITION_SETTLE_MS)
      cy.screenshot(`edit-${theme}`, readmeGalleryShotOpts)
    })
  }
})

export {}
