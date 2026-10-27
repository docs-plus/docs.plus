/// <reference types="cypress" />

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
    // package's Hyperlink), so its destroy runs the mark's onDestroy hook.
    // That hook must only close popovers the scratch editor itself opened.
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

  // The reason for the contract: an orphan is invisible to the controller. The
  // next adopt() then has no `previous` to evict, and both stay on screen.
  // Assert the count — controller state alone cannot fail here, since neither
  // the old nor the new code re-adopts on show().
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

  it('still opens normally on a fresh popover', () => {
    cy.window().then((win) => {
      const popover = openBarePopover(win)
      expect(popover.isVisible()).to.equal(true)
      popover.destroy()
    })
  })
})

describe('destroy lifecycle — hovercard', () => {
  type HovercardWindow = Cypress.AUTWindow & { _hovercard: { calls: string[] } }

  beforeEach(() => {
    cy.visitPlayground({ query: 'hovercard=cover' })
    cy.setEditorContent(DOC)
  })

  // The dwell has fired and the stub has not answered yet when the editor goes.
  const hoverUntilFetch = (): void => {
    // Timers and Date only: Cypress 16 also fakes rAF, which the engine needs.
    cy.clock(Date.now(), ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'])
    cy.get('#editor a').realHover()
    cy.tick(150)
    cy.window().its('_hovercard.calls').should('have.length', 1)
  }

  it('destroying the editor during the fetch leaves no card in the body', () => {
    hoverUntilFetch()
    cy.window().then((win) => win._editor.destroy())
    cy.tick(100)
    // The stub's answer lands at the next real task; then the open time passes.
    cy.wait(0)
    cy.tick(2000)
    cy.get('.hyperlink-hovercard').should('not.exist')
  })

  it('unmounting the editor during the fetch leaves no card in the body', () => {
    hoverUntilFetch()
    cy.window().then((win) => win._editor.unmount())
    cy.tick(100)
    // The stub's answer lands at the next real task; then the open time passes.
    cy.wait(0)
    cy.tick(2000)
    cy.get('.hyperlink-hovercard').should('not.exist')
  })

  it('destroying editor B keeps the preview that editor A opened', () => {
    cy.get('#editor a').click()
    cy.get(PREVIEW).should('be.visible')

    // B copies A's extensions, so it runs its own hovercard plugin and tears it down.
    cy.window().then((win) => {
      expect((win as HovercardWindow)._hovercard, 'hovercard is on').to.be.an('object')
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
        content: '<p>scratch <a href="https://b.example/">B</a></p>'
      })
      scratch.destroy()
      host.remove()
    })

    cy.get(PREVIEW).should('be.visible')
    cy.get('.floating-popover').should('have.class', 'visible')
  })
})

export {}
