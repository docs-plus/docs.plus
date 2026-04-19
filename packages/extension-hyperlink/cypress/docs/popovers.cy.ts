/// <reference types="cypress" />

/**
 * README screenshot gallery — regenerate with `bun run docs:screenshots`.
 *
 * This spec is intentionally OUTSIDE `cypress/e2e/` so the regular
 * `cy:run` test pattern (`cypress/e2e/**\/*.cy.ts`) ignores it. The
 * `docs:screenshots` script overrides `specPattern` from the CLI to
 * point Cypress at this folder.
 *
 * NOTE: This folder must NOT be `cypress/screenshots/` — that path is
 * Cypress's default `screenshotsFolder` and gets wiped before each run,
 * which would delete this spec.
 *
 * The `after:screenshot` hook in `cypress.config.ts` flattens the
 * captured PNGs into `docs/screenshots/<name>.png` so the README's raw
 * GitHub URLs can stay short and stable.
 */

const DOC_WITH_LINK =
  '<p>Click <a href="https://example.com">this link</a> to see the preview popover.</p>'

const setTheme = (theme: 'light' | 'dark') =>
  cy.window().then((w) => w.document.documentElement.setAttribute('data-theme', theme))

// Wait long enough for the floating-toolbar opacity/transform transition
// (120ms per `--hl-transition`) plus a frame of slack — `be.visible`
// resolves at first paint, not at end of animation.
const TRANSITION_SETTLE_MS = 250

const SHOT_OPTS = { capture: 'viewport', overwrite: true } as const

describe('README screenshot gallery', { testIsolation: false }, () => {
  beforeEach(() => {
    // Tighter viewport keeps the popover near the link in the captured
    // frame and produces a README-friendly aspect ratio.
    cy.viewport(900, 540)
    cy.visitPlayground()
  })

  it('captures preview popover (light theme)', () => {
    setTheme('light')
    cy.setEditorContent(DOC_WITH_LINK)
    cy.get('#editor a').click()
    cy.get('.hyperlink-preview-popover').should('be.visible')
    cy.wait(TRANSITION_SETTLE_MS)
    cy.screenshot('preview-light', SHOT_OPTS)
  })

  it('captures preview popover (dark theme)', () => {
    setTheme('dark')
    cy.setEditorContent(DOC_WITH_LINK)
    cy.get('#editor a').click()
    cy.get('.hyperlink-preview-popover').should('be.visible')
    cy.wait(TRANSITION_SETTLE_MS)
    cy.screenshot('preview-dark', SHOT_OPTS)
  })
})
