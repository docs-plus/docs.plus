/// <reference types="cypress" />

/**
 * Regression: every prebuilt popover must follow its anchor during scroll.
 *
 * Background: the floating toolbar is `position: fixed`, so whoever
 * supplies the reference must hand floating-ui a `getBoundingClientRect`
 * that returns LIVE viewport coordinates on every call. Real DOM
 * elements get this for free (the browser recomputes their rect on every
 * call); virtual references built from snapshotted coords do not — they
 * freeze the popover at its open-time viewport position and let the
 * anchor scroll out from under it.
 *
 * Pre-fix shape of the bug:
 *   - Preview popover (uses `referenceElement: <a>`)            → fine.
 *   - Edit popover    (used cached `linkCoords`, virtual ref)   → broken.
 *   - Create popover  (used cached `coordsAtPos()`, virtual ref) → broken.
 *
 * Both popovers were fixed at their respective sites:
 *   - Edit popover now uses `referenceElement: link` directly.
 *   - Create popover now passes a closure that recomputes coords from
 *     the captured `from` / `to` ProseMirror positions on every call.
 */

const PREVIEW = '.hyperlink-preview-popover'
const CREATE = '.hyperlink-create-popover'
const EDIT = '.hyperlink-edit-popover'
const FLOATING = '.floating-toolbar'

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
// One animation frame for autoUpdate's scroll listener + one tick for
// floating-ui's async computePosition Promise to resolve.
const REPOSITION_WAIT_MS = 100

/**
 * Assert that the popover's top edge moves by exactly the same delta
 * as the anchor's top edge across a scroll. This is the real invariant:
 * how much the page actually scrolled doesn't matter (it can be
 * dampened by post-scroll input-focus shenanigans), only that the
 * popover tracks the anchor 1-for-1.
 */
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
    // The preview popover always used the live `<a>` element as its
    // reference, so this has worked since v4.0. Pinning it here
    // documents the baseline that the create / edit fixes match.
    cy.setEditorContent(buildLongDoc('<a href="https://example.com">click me</a>'))
    cy.get('#editor a').scrollIntoView().click()
    cy.get(PREVIEW).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING, '#editor a')
  })

  it('edit popover follows the link when the page scrolls (regression: cached linkCoords)', () => {
    // Repro of the original bug: open the preview, click "edit", scroll.
    // Pre-fix, the edit popover was built from a `linkCoords` snapshot
    // captured at click time and stayed glued to the viewport.
    cy.setEditorContent(buildLongDoc('<a href="https://example.com">click me</a>'))
    cy.get('#editor a').scrollIntoView().click()
    cy.get(`${PREVIEW} button.edit`).click()
    cy.get(EDIT).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING, '#editor a')
  })

  it('create popover dismisses itself when a doc mutation invalidates the captured selection range', () => {
    // Defensive path for collab edits: the create popover captures
    // ProseMirror `from`/`to` once at open time and recomputes coords
    // from them on every reposition. A remote op (Yjs / Hocuspocus)
    // shrinking the doc after the popover opens makes those positions
    // out-of-range, and `view.coordsAtPos()` throws — the rejection
    // surfaces *inside* `computePosition`, where `autoUpdate` doesn't
    // catch it and Cypress fails the test on the unhandled rejection.
    //
    // The fix catches the throw and queues a microtask to dismiss the
    // popover: the anchor is gone, so there's nothing meaningful for
    // the form to attach to. We simulate the remote op by calling
    // `setContent('')` directly — same observable: invalid captured
    // positions on the next reposition.
    cy.setEditorContent(buildLongDoc('select-this-target-word'))
    cy.contains('#editor p', 'select-this-target-word').scrollIntoView()
    cy.selectText('select-this-target-word')
    cy.get('body').realPress(['Meta', 'K'])
    cy.get(CREATE).should('be.visible')

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
    // Repro of the original bug: select text, Cmd+K, scroll. Pre-fix,
    // the create popover was built from a `view.coordsAtPos(from)`
    // snapshot and stayed glued to the viewport while the selected
    // text scrolled away. Selection has no DOM node, so we proxy on
    // the `<p>` containing it — same scroll delta as the selection.
    //
    // Pre-positioning the anchor near the TOP of the viewport
    // (`scrollIntoView` defaults to block: 'start') guarantees there's
    // ~600px of headroom below for the popover, so floating-ui's
    // `flip()` middleware doesn't swap placement during the scroll
    // and dampen the apparent delta. ProseMirror's selectText alone
    // uses `scrollPosIntoView` which only scrolls the minimum amount —
    // anchor lands at the viewport BOTTOM, which trips flip.
    cy.setEditorContent(buildLongDoc('select-this-target-word'))
    cy.contains('#editor p', 'select-this-target-word').scrollIntoView()
    cy.selectText('select-this-target-word')
    cy.get('body').realPress(['Meta', 'K'])
    cy.get(CREATE).should('be.visible')
    expectPopoverFollowsAnchor(FLOATING, '#editor p:contains("select-this-target-word")')
  })
})

// Make this file an ES module so the top-level `const PREVIEW`/`EDIT`
// don't collide with the same identifiers in `preview-edit.cy.ts` under
// Cypress's shared TS project.
export {}
