/// <reference types="cypress" />

const PREVIEW = '.hyperlink-preview-popover'
const CREATE = '.hyperlink-create-popover'
const EDIT = '.hyperlink-edit-popover'
const FLOATING = '.floating-popover'
const FLOATING_VISIBLE = '.floating-popover.visible'

// Tall enough that the playground's centered card overflows the 800px
// viewport and the document scrolls. Those 80 paragraphs give ≈ 2400px of
// doc height. That is plenty of headroom on either side of the anchor for a
// 200px scroll without pushing the anchor off-screen.
const buildLongDoc = (anchorHtml: string): string => {
  const filler = Array.from({ length: 40 }, (_, i) => `<p>Filler paragraph ${i + 1}.</p>`).join('')
  return `${filler}<p>Anchor: ${anchorHtml}</p>${filler}`
}

const SCROLL_PX = 200
// Park the anchor mid-viewport (800px tall) before measuring. Cypress' default
// `scrollBehavior: 'top'` leaves it at y≈0, where scrolling SCROLL_PX pushes it
// off-screen. There `shift` clamps the popover to the top padding and `hide`
// marks it hidden — correct engine behaviour, but not 1-for-1 tracking.
const ANCHOR_VIEWPORT_TOP_PX = 400
// Settle window for any open-time auto-scroll (input focus on the create
// popover, ProseMirror scrollIntoView on selection set), taken BEFORE the
// `before` measurement. The deltas then reflect only the test's own scrollBy,
// not the popover's own startup choreography.
const SETTLE_MS = 200
// autoUpdate scroll listener + floating-ui computePosition; headless Linux CI
// needs more than one rAF tick.
const REPOSITION_WAIT_MS = 200

const pinAnchorInViewport = (anchorSelector: string): void => {
  cy.get(anchorSelector).then(($a) => {
    const delta = $a[0].getBoundingClientRect().top - ANCHOR_VIEWPORT_TOP_PX
    cy.window().then((win) => win.scrollBy(0, delta))
  })
}

// Equal Δtop is the real invariant: how far the page actually scrolled can be
// dampened by post-scroll focus shifts, so only 1-for-1 tracking matters.
const expectPopoverFollowsAnchor = (
  popoverSelector: string,
  anchorSelector: string,
  tolerancePx = 4
): void => {
  pinAnchorInViewport(anchorSelector)
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(SETTLE_MS)
  cy.get(popoverSelector).then(($p) => {
    const popBefore = $p[0].getBoundingClientRect().top
    cy.get(anchorSelector).then(($a) => {
      const anchorBefore = $a[0].getBoundingClientRect().top
      cy.window().then((win) => win.scrollBy(0, SCROLL_PX))
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(REPOSITION_WAIT_MS)
      cy.get(popoverSelector).then(($p2) => {
        cy.get(anchorSelector).then(($a2) => {
          const popAfter = $p2[0].getBoundingClientRect().top
          const anchorAfter = $a2[0].getBoundingClientRect().top
          const popDelta = popBefore - popAfter
          const anchorDelta = anchorBefore - anchorAfter
          expect(
            popDelta,
            `popover Δtop (${popDelta.toFixed(1)}) should match anchor Δtop (${anchorDelta.toFixed(1)})`
          ).to.be.closeTo(anchorDelta, tolerancePx)
        })
      })
    })
  })
}

describe('Popover scroll-stickiness — anchor-following on window scroll', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('preview popover follows the link when the page scrolls (working baseline)', () => {
    cy.setEditorContent(buildLongDoc('<a href="https://example.com">click me</a>'))
    cy.get('#editor a').scrollIntoView().click()
    cy.getVisibleFloatingPopover().find(PREVIEW).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING_VISIBLE, '#editor a')
  })

  it('edit popover follows the link when the page scrolls (regression: cached linkCoords)', () => {
    cy.setEditorContent(buildLongDoc('<a href="https://example.com">click me</a>'))
    cy.get('#editor a').scrollIntoView().click()
    cy.get(`${PREVIEW} button.edit`).click()
    cy.getVisibleFloatingPopover().find(EDIT).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING_VISIBLE, '#editor a')
  })

  it('create popover dismisses itself when a doc mutation invalidates the captured selection range', () => {
    // A remote op (Yjs) shrinking the doc puts the create popover's captured
    // `from`/`to` out of range. Then `coordsAtPos()` throws inside
    // `computePosition`, where `autoUpdate` never catches the error.
    // `setContent` reproduces the same invalid-position reposition a remote op would.
    cy.setEditorContent(buildLongDoc('select-this-target-word'))
    cy.contains('#editor p', 'select-this-target-word').scrollIntoView()
    cy.selectText('select-this-target-word')
    cy.pressModK()
    cy.getVisibleFloatingPopover().find(CREATE).should('be.visible')

    cy.window().then((win) => {
      win._editor.commands.setContent('<p>replaced</p>')
      win.scrollBy(0, SCROLL_PX)
    })
    cy.get(FLOATING).should('not.exist')
  })

  it('create popover follows the selection when the page scrolls (regression: cached coordsAtPos)', () => {
    // A selection has no DOM node, so the containing `<p>` proxies for it.
    cy.setEditorContent(buildLongDoc('select-this-target-word'))
    cy.contains('#editor p', 'select-this-target-word').scrollIntoView()
    cy.selectText('select-this-target-word')
    cy.pressModK()
    cy.getVisibleFloatingPopover().find(CREATE).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING_VISIBLE, '#editor p:contains("select-this-target-word")')
  })
})

// Make this file an ES module so the top-level `const PREVIEW`/`EDIT`
// don't collide with the same identifiers in `preview-edit.cy.ts` under
// Cypress's shared TS project.
export {}
