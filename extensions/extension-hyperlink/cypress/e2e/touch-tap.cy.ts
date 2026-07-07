/// <reference types="cypress" />

/**
 * Touch-tap spec — the `handleDOMEvents.touchend` path in clickHandler.ts.
 *
 * On phones the extension owns link taps at `touchend`: it opens the preview
 * popover and calls `preventDefault()`, which suppresses the browser's
 * synthesized click — the event that would otherwise navigate or, on iOS
 * Safari, place the caret and pop the keyboard. Every other spec drives
 * `click`, so a regression in the touchend path would break phone taps while
 * the whole desktop suite stays green.
 *
 * A dispatched (untrusted) TouchEvent never synthesizes a follow-up click,
 * so the synthetic cases below isolate the touchend handler: if it stops
 * running, no other path opens the popover and the assertions fail. The
 * realTouch case replays the full trusted CDP touch sequence end-to-end.
 */

const PREVIEW = '.hyperlink-preview-popover'
const SAFE_HREF = 'https://example.com/'
const SAFE_FEATURES = 'noopener,noreferrer'
const DOC_WITH_LINK = `<p>Visit <a href="${SAFE_HREF}">Example</a> for more info.</p>`

const stubWindowOpen = (alias = 'windowOpen'): void => {
  cy.window().then((w) => {
    cy.stub(w, 'open').as(alias)
  })
}

// Native TouchEvent with `changedTouches` coordinates (the handler feeds
// them to posAtCoords), built in the AUT realm so Chrome accepts the Touch.
const dispatchTouchEnd = (selector: string): Cypress.Chainable<TouchEvent> => {
  return cy.window().then((win) => {
    return cy.get(selector).then(($el) => {
      const target = $el[0]
      const rect = target.getBoundingClientRect()
      const clientX = rect.left + rect.width / 2
      const clientY = rect.top + rect.height / 2
      const touch = new win.Touch({ identifier: 1, target, clientX, clientY })
      const event = new win.TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        touches: [],
        changedTouches: [touch]
      })
      target.dispatchEvent(event)
      return event
    })
  })
}

describe('Touch tap — editable doc with the prebuilt preview popover', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent(DOC_WITH_LINK)
  })

  it('opens the preview popover from touchend alone and consumes the tap', () => {
    stubWindowOpen()
    dispatchTouchEnd('#editor a').then((event) => {
      // preventDefault on touchend is what stops the synthesized click on a
      // real device — without it the tap navigates / places the iOS caret.
      expect(event.defaultPrevented, 'touchend default prevented').to.eq(true)
    })
    cy.get(PREVIEW).should('be.visible')
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('opens the preview popover through the full trusted touch sequence (realTouch)', () => {
    cy.get('#editor a').realTouch()
    cy.get(PREVIEW).should('be.visible')
    // The tap must never leave the playground page.
    cy.location('href').should('contain', '127.0.0.1:5173')
  })
})

describe('Touch tap — read-only fallback (?readonly=on&popover=none)', () => {
  beforeEach(() => {
    cy.visit('/?readonly=on&popover=none')
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
  })

  it('routes a tap through the gated window.open fallback in a read-only doc', () => {
    cy.setEditorContent(DOC_WITH_LINK)
    stubWindowOpen()
    dispatchTouchEnd('#editor a')
    cy.get('@windowOpen').should('have.been.calledOnce')
    cy.get('@windowOpen').its('firstCall.args.0').should('equal', SAFE_HREF)
    cy.get('@windowOpen').its('firstCall.args.1').should('equal', '_blank')
    cy.get('@windowOpen').its('firstCall.args.2').should('equal', SAFE_FEATURES)
  })
})

// Module scope: keeps top-level consts out of the shared-global TS project.
export {}
