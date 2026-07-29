/// <reference types="cypress" />

// The floating toolbar is `position: fixed`, so its reference must hand
// floating-ui a `getBoundingClientRect` returning LIVE viewport coords on
// every call. Virtual refs built from snapshotted coords froze the edit and
// create popovers at their open-time position while the anchor scrolled away.

const PREVIEW = '.hyperlink-preview-popover'
const CREATE = '.hyperlink-create-popover'
const EDIT = '.hyperlink-edit-popover'
const FLOATING = '.floating-popover'
const FLOATING_VISIBLE = '.floating-popover.visible'

// Tall enough that the playground's centered card overflows the 800px
// viewport and the document scrolls. 80 paragraphs ≈ 2400px of doc
// height — plenty of headroom on either side of the anchor for a
// 200px scroll without pushing it off-screen.
const buildLongDoc = (anchorHtml: string): string => {
  const filler = Array.from({ length: 40 }, (_, i) => `<p>Filler paragraph ${i + 1}.</p>`).join('')
  return `${filler}<p>Anchor: ${anchorHtml}</p>${filler}`
}

const SCROLL_PX = 200
// Settle window for any open-time auto-scroll (input focus on the
// create popover, ProseMirror scrollIntoView on selection set) BEFORE
// taking the `before` measurement, so the deltas reflect just the
// test's own scrollBy and not the popover's own startup choreography.
const SETTLE_MS = 200
// autoUpdate scroll listener + floating-ui computePosition; headless Linux CI
// needs more than one rAF tick.
const REPOSITION_WAIT_MS = 200

/** selectText scrolls the caret to the viewport bottom; pin upper so flip() stays stable. */
const pinSelectionNearViewportTop = (offsetPx = 120) => {
  cy.window().then((win) => {
    const { from } = win._editor.state.selection
    const top = win._editor.view.coordsAtPos(from).top
    win.scrollBy(0, top - offsetPx)
  })
}

// Equal Δtop is the real invariant: how far the page actually scrolled can be
// dampened by post-scroll focus shifts, so only 1-for-1 tracking matters.
const expectPopoverFollowsAnchor = (
  popoverSelector: string,
  anchorSelector: string,
  tolerancePx = 4
): void => {
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
          // Pre-fix: anchorDelta ≈ 200, popDelta ≈ 0 → diff ≈ 200 → fail.
          // Post-fix: anchorDelta and popDelta both move the same amount.
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
    // The preview popover always used the live `<a>` as its reference — the
    // working baseline the create / edit fixes were matched against.
    cy.setEditorContent(buildLongDoc('<a href="https://example.com">click me</a>'))
    cy.get('#editor a').scrollIntoView().click()
    cy.getVisibleFloatingPopover().find(PREVIEW).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING_VISIBLE, '#editor a')
  })

  it('edit popover follows the link when the page scrolls (regression: cached linkCoords)', () => {
    // Repro of the original bug: open the preview, click "edit", scroll.
    // Pre-fix, the edit popover was built from a `linkCoords` snapshot
    // captured at click time and stayed glued to the viewport.
    cy.setEditorContent(buildLongDoc('<a href="https://example.com">click me</a>'))
    cy.get('#editor a').scrollIntoView().click()
    cy.get(`${PREVIEW} button.edit`).click()
    cy.getVisibleFloatingPopover().find(EDIT).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING_VISIBLE, '#editor a')
  })

  it('create popover dismisses itself when a doc mutation invalidates the captured selection range', () => {
    // A remote op (Yjs) shrinking the doc puts the create popover's captured
    // `from`/`to` out of range, and `coordsAtPos()` throws inside
    // `computePosition`, where `autoUpdate` never catches it. `setContent`
    // reproduces the same invalid-position reposition a remote op would.
    cy.setEditorContent(buildLongDoc('select-this-target-word'))
    cy.contains('#editor p', 'select-this-target-word').scrollIntoView()
    cy.selectText('select-this-target-word')
    cy.pressModK()
    cy.getVisibleFloatingPopover().find(CREATE).should('be.visible')

    cy.window().then((win) => {
      win._editor.commands.setContent('<p>replaced</p>')
      win.scrollBy(0, SCROLL_PX)
    })
    // Pre-fix: Cypress would already have failed on the unhandled
    // rejection from `coordsAtPos`. Post-fix: the popover tears
    // itself down — no phantom listeners, no focus trap on an
    // invisible form, no popover lingering in the DOM.
    cy.get(FLOATING).should('not.exist')
  })

  it('create popover follows the selection when the page scrolls (regression: cached coordsAtPos)', () => {
    // Pre-fix the create popover froze at its `coordsAtPos(from)` snapshot.
    // A selection has no DOM node, so the containing `<p>` proxies for it.
    // `pinSelectionNearViewportTop` keeps headroom below the selection so
    // flip() cannot swap placement mid-scroll and break the equal-Δtop test.
    cy.setEditorContent(buildLongDoc('select-this-target-word'))
    cy.contains('#editor p', 'select-this-target-word').scrollIntoView()
    cy.selectText('select-this-target-word')
    pinSelectionNearViewportTop()
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(SETTLE_MS)
    cy.pressModK()
    cy.getVisibleFloatingPopover().find(CREATE).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING_VISIBLE, '#editor p:contains("select-this-target-word")')
  })
})

// Make this file an ES module so the top-level `const PREVIEW`/`EDIT`
// don't collide with the same identifiers in `preview-edit.cy.ts` under
// Cypress's shared TS project.
export {}
