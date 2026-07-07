/// <reference types="cypress" />

/**
 * Touch-tap spec — the coarse-pointer entry into the media controls.
 *
 * On phones `(pointer: fine)` is false, so hover controls are gated off and
 * the synthesized click after a tap is the ONLY way handleMediaClick can
 * open the toolbar + gripper. Every other spec hovers first, which would
 * mask a click-path regression: these tests drive the mobile tap sequence
 * (touchstart → touchend → click, no mouseover) — exactly what reaches the
 * handlers on a touch device.
 */

const TOOLBAR = '#editor .media-toolbar'
const ACTIVE_GRIPPER = '#editor .hypermultimedia__resize-gripper--active'

// Mobile tap tail in the AUT realm. No mouseover: hover is (pointer: fine)-
// gated on devices, so the click handler must open the controls on its own.
const tapCenter = (selector: string): Cypress.Chainable<MouseEvent> => {
  return cy.window().then((win) => {
    return cy.get(selector).then(($el) => {
      const target = $el[0]
      const rect = target.getBoundingClientRect()
      const clientX = rect.left + rect.width / 2
      const clientY = rect.top + rect.height / 2
      const touch = new win.Touch({ identifier: 1, target, clientX, clientY })
      target.dispatchEvent(
        new win.TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touch],
          changedTouches: [touch]
        })
      )
      target.dispatchEvent(
        new win.TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [touch]
        })
      )
      const click = new win.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX,
        clientY
      })
      target.dispatchEvent(click)
      return click
    })
  })
}

describe('media controls — touch tap (no hover)', () => {
  it('opens the toolbar and gripper from a tap on an image and consumes the click', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    tapCenter('#editor img').then((click) => {
      // preventDefault is the "no caret, no text selection" half of the tap
      // contract — the tap selects the media, it must not start editing text.
      expect(click.defaultPrevented, 'tap click default prevented').to.eq(true)
    })
    cy.get(TOOLBAR).should('exist')
    cy.get(ACTIVE_GRIPPER).should('exist')
  })

  it('dismisses the controls on a touch pointerdown outside the media', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    tapCenter('#editor img')
    cy.get(TOOLBAR).should('exist')

    // Outside dismissal listens for capture-phase document pointerdown —
    // on phones that event's pointerType is 'touch', never 'mouse'.
    cy.window().then((win) => {
      cy.get('#editor p').then(($p) => {
        const target = $p[0]
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(
          new win.PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
            clientX: rect.left + 5,
            clientY: rect.top + 5
          })
        )
      })
    })

    cy.get(TOOLBAR).should('not.exist')
    cy.get(ACTIVE_GRIPPER).should('not.exist')
    cy.get('#editor .hm-has-toolbar').should('not.exist')
  })
})

export {}
