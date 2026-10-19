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

// Each scene folds its source, so the chart alone fits the 900x540 capture.
const SCENES = [
  {
    name: 'xychart',
    lead: 'Track a week of signups.',
    source: [
      'xychart-beta',
      '  title "Weekly signups"',
      '  x-axis [Mon, Tue, Wed, Thu, Fri, Sat, Sun]',
      '  y-axis "Signups" 0 --> 120',
      '  bar [32, 48, 60, 75, 88, 70, 110]',
      '  line [32, 48, 60, 75, 88, 70, 110]'
    ]
  },
  {
    name: 'sankey',
    lead: 'See where visitors go.',
    source: [
      'sankey-beta',
      '  Visitors,Sign up,60',
      '  Visitors,Bounce,40',
      '  Sign up,Write,45',
      '  Sign up,Idle,15',
      '  Write,Share,30'
    ]
  },
  {
    name: 'mindmap',
    lead: 'Map the product at a glance.',
    source: [
      'mindmap',
      '  root((docs.plus))',
      '    Write',
      '      Headings',
      '      Diagrams',
      '    Talk',
      '      Chat per heading',
      '    Share',
      '      Links',
      '      Embeds'
    ]
  },
  {
    name: 'sequence',
    lead: 'Show how a diagram renders.',
    source: [
      'sequenceDiagram',
      '  participant You',
      '  participant Editor',
      '  participant Pele',
      '  You->>Editor: Type a fence',
      '  Editor->>Pele: render(source)',
      '  Pele-->>Editor: SVG',
      '  Editor-->>You: Live diagram'
    ]
  }
] as const

describe('README screenshot gallery — diagram types', { testIsolation: false }, () => {
  beforeEach(() => {
    prepareReadmeGalleryViewport()
    cy.clock(FIXED_MS, ['Date'])
    // The fold choice is stored per source, so the second theme would start folded.
    cy.clearLocalStorage()
    cy.visitPlayground()
  })

  for (const scene of SCENES) {
    for (const theme of ['light', 'dark'] as const) {
      it(`captures a ${scene.name} diagram (${theme} theme)`, () => {
        setPlaygroundTheme(theme)
        cy.setEditorContent(`<p>${scene.lead}</p>${block(scene.source.join('\n'))}`)
        cy.get('.mermaid-diagram [data-state="ready"] svg.pele').should('be.visible')
        // The head actions show on hover or focus only. Blur after, so the shot hides them.
        cy.get('.mermaid-diagram__fold').focus().click()
        cy.get('.mermaid-diagram__fold').blur()
        cy.get('.mermaid-diagram[data-source="folded"]').should('exist')
        // Focus scrolled the page. Frame the shot from the lead line down.
        cy.contains('p', scene.lead).scrollIntoView({ offset: { top: -16, left: 0 } })
        cy.screenshot(`${scene.name}-${theme}`, readmeGalleryShotOpts)
      })
    }
  }
})

export {}
