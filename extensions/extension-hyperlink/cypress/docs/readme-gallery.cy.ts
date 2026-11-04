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
const HOVERCARD = '.floating-popover.visible .hyperlink-hovercard'

// A plain share picture for the hovercard shot, so the gallery needs no network.
const GALLERY_PICTURE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/>' +
  '</linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>' +
  '<text x="600" y="345" fill="#ffffff" font-family="system-ui, sans-serif" font-size="96" ' +
  'font-weight="700" text-anchor="middle">docs.plus</text></svg>'

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
      cy.pressModK()
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

    it(`captures the built-in hovercard (${theme} theme)`, () => {
      cy.intercept(
        { pathname: '/readme-media/hovercard/gallery.svg' },
        { body: GALLERY_PICTURE, headers: { 'content-type': 'image/svg+xml' } }
      )
      cy.visitPlayground({ query: 'hovercard=on' })
      setPlaygroundTheme(theme)
      cy.setEditorContent('<p>Rest the pointer on <a href="https://docs.plus/">docs.plus</a>.</p>')
      cy.contains('#editor a', 'docs.plus').realHover()
      cy.get(HOVERCARD).should('be.visible')
      cy.get(`${HOVERCARD} .hyperlink-hovercard__image`).should('have.attr', 'data-state', 'ready')
      cy.wait(TRANSITION_SETTLE_MS)
      cy.screenshot(`hovercard-${theme}`, readmeGalleryShotOpts)
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
