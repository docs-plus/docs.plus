/// <reference types="cypress" />

/** README gallery — `bun run docs:screenshots`; skipped by release-gate `cypress/e2e/` runs. */

import {
  prepareReadmeGalleryViewport,
  readmeGalleryShotOpts,
  setPlaygroundTheme
} from '@docs.plus/playground/cypress/readmeGallery'

const FIXED_MS = Date.UTC(2026, 9, 1)

// A short flow fits the 900x540 capture. The four-line starter is cropped there.
const SOURCE = ['flowchart LR', '  A[Write] --> B[See it] --> C[Share]'].join('\n')

const block = (source: string): string =>
  `<pre><code class="language-mermaid">${source.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`

describe('README screenshot gallery', { testIsolation: false }, () => {
  beforeEach(() => {
    prepareReadmeGalleryViewport()
    // Freeze `Date` only: the 300 ms redraw delay needs real timers.
    cy.clock(FIXED_MS, ['Date'])
    cy.visitPlayground()
    cy.setEditorContent(`<p>Plan the release as a flow.</p>${block(SOURCE)}`)
    cy.get('.mermaid-diagram > [data-state="ready"] svg.pele').should('be.visible')
  })

  for (const theme of ['light', 'dark'] as const) {
    it(`captures a Mermaid diagram (${theme} theme)`, () => {
      setPlaygroundTheme(theme)
      cy.screenshot(`preview-${theme}`, readmeGalleryShotOpts)
    })
  }
})

export {}
