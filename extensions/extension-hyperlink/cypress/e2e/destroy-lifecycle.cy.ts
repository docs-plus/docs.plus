/// <reference types="cypress" />

/**
 * Editor-destroy lifecycle for the popover singleton: destroying the
 * editor that opened a popover tears it down (no leaked body-appended
 * DOM), while destroying an unrelated editor must leave it untouched.
 */

const PREVIEW = '.hyperlink-preview-popover'
const DOC = '<p>Visit <a href="https://example.com">Example</a> now.</p>'

describe('destroy lifecycle — popover ownership', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
  })

  it('destroying the editor closes its open popover and leaves no popover DOM in the body', () => {
    cy.get('#editor a').click()
    cy.get('.floating-popover').should('have.class', 'visible')
    cy.window().then((win) => {
      win._editor.destroy()
    })
    cy.get('.floating-popover').should('not.exist')
    cy.get(PREVIEW).should('not.exist')
  })

  it('destroying an unrelated editor leaves the open popover mounted (ownership)', () => {
    cy.get('#editor a').click()
    cy.get(PREVIEW).should('be.visible')

    // Scratch editor wired with the same extension set (including this
    // package's Hyperlink), so its destroy runs the mark's onDestroy hook
    // — which must only close popovers the scratch editor itself opened.
    cy.window().then((win) => {
      const host = win.document.createElement('div')
      win.document.body.appendChild(host)
      const EditorCtor = win._editor.constructor as unknown as new (options: {
        element: HTMLElement
        extensions: unknown
        content: string
      }) => { destroy: () => void }
      const scratch = new EditorCtor({
        element: host,
        extensions: win._editor.options.extensions,
        content: '<p>scratch</p>'
      })
      scratch.destroy()
      host.remove()
    })

    cy.get(PREVIEW).should('be.visible')
    cy.get('.floating-popover').should('have.class', 'visible')
  })
})

/**
 * `createPopover` is public API, so a BYO consumer can drive show/hide directly.
 * Hiding releases controller ownership and nothing re-adopts, so re-showing
 * would leave a popover on screen that `close()` cannot see and the next
 * `adopt()` will not evict — two popovers at once. `hide()` is terminal instead.
 */
describe('popover one-shot contract', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
  })

  const buildPopover = (win: Cypress.AUTWindow, marker: string) => {
    const { createPopover } = win._hyperlink
    const anchor = win.document.querySelector('#editor a') as HTMLElement
    const content = win.document.createElement('div')
    content.className = marker
    content.textContent = marker
    return createPopover({ referenceElement: anchor, content })
  }

  const openBarePopover = (win: Cypress.AUTWindow) => {
    const popover = buildPopover(win, 'probe-popover-content')
    popover.show()
    return popover
  }

  it('does not reopen after hide, and leaves no orphan in the body', () => {
    cy.window().then((win) => {
      const popover = openBarePopover(win)
      expect(popover.isVisible(), 'visible after show').to.equal(true)

      popover.hide()
      popover.show()

      expect(popover.isVisible(), 'stays hidden after re-show').to.equal(false)
    })
    cy.get('.probe-popover-content').should('not.exist')
  })

  // The reason for the contract: an orphan is invisible to the controller, so
  // the next adopt() has no `previous` to evict and both stay on screen. Assert
  // the count — controller state alone cannot fail here, since neither the old
  // nor the new code re-adopts on show().
  it('cannot strand an orphan alongside the next popover', () => {
    cy.window().then((win) => {
      const first = openBarePopover(win)
      first.hide()
      first.show()

      buildPopover(win, 'second-popover-content').show()
    })
    cy.get('.floating-popover').should('have.length', 1)
    cy.get('.second-popover-content').should('exist')
    cy.get('.probe-popover-content').should('not.exist')
  })

  it('does not resurrect a destroyed popover', () => {
    cy.window().then((win) => {
      const popover = openBarePopover(win)
      popover.destroy()
      popover.show()
      expect(popover.isVisible(), 'stays destroyed').to.equal(false)
    })
    cy.get('.probe-popover-content').should('not.exist')
  })

  // `hide()` before the first `show()` early-returns without releasing ownership,
  // so there is no orphan to prevent and the popover must still open. Hoisting
  // `terminated` above that guard would break this defensive-hide path.
  it('still opens after a hide() that preceded the first show()', () => {
    cy.window().then((win) => {
      const popover = buildPopover(win, 'probe-popover-content')
      popover.hide()
      popover.show()
      expect(popover.isVisible(), 'opens after a no-op hide').to.equal(true)
      popover.destroy()
    })
  })

  // The terminal flag must not break the ordinary create -> show path, which is
  // what every first-party opener does.
  it('still opens normally on a fresh popover', () => {
    cy.window().then((win) => {
      const popover = openBarePopover(win)
      expect(popover.isVisible()).to.equal(true)
      popover.destroy()
    })
  })
})

export {}
