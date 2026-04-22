/// <reference types="cypress" />

/**
 * Navigation safety spec — middle-click (`auxclick`) is the surface
 * tested here.
 *
 * Sister spec to `xss-guards.cy.ts`, which covers the *write* side
 * (parseHTML, input rules, paste rules). This file covers the *read*
 * side — what happens when an existing link in the doc is clicked
 * with the middle mouse button.
 *
 * Without the auxclick handler that ships with the extension, middle-
 * click would bypass the capture-phase primary-click guard entirely
 * and the browser would open the raw `<a href>` in a new tab — a full
 * circumvention of `isAllowedUri` and the dangerous-scheme block. Pin
 * the gate so any future regression breaks fast and loud.
 *
 * Read-only `window.open` fallback (no popover configured) is exercised
 * by `xss-guards.cy.ts` at the click-handler boundary and by the
 * `validateURL` Bun-test suite at the gate boundary.
 */

const SAFE_HREF = 'https://example.com/'
const SAFE_FEATURES = 'noopener,noreferrer'

const stubWindowOpen = (alias = 'windowOpen'): void => {
  cy.window().then((w) => {
    cy.stub(w, 'open').as(alias)
  })
}

const dispatchAuxClick = (selector: string): void => {
  cy.get(selector).then(($el) => {
    const target = $el[0]
    const rect = target.getBoundingClientRect()
    target.dispatchEvent(
      new MouseEvent('auxclick', {
        bubbles: true,
        cancelable: true,
        button: 1,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      })
    )
  })
}

describe('Navigation guards — middle-click (auxclick)', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('opens safe hrefs in _blank with noopener,noreferrer features', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    stubWindowOpen()
    dispatchAuxClick('#editor a')
    cy.get('@windowOpen').should('have.been.calledOnce')
    cy.get('@windowOpen').its('firstCall.args.0').should('equal', SAFE_HREF)
    cy.get('@windowOpen').its('firstCall.args.1').should('equal', '_blank')
    cy.get('@windowOpen').its('firstCall.args.2').should('equal', SAFE_FEATURES)
  })

  it('refuses to open injected javascript: anchors', () => {
    // parseHTML strips dangerous hrefs on document load, so synthesize
    // a tampered anchor (simulating a misbehaving downstream extension)
    // and confirm the auxclick handler still refuses navigation.
    cy.setEditorContent('<p>x</p>')
    cy.get('#editor p').then(($p) => {
      const a = document.createElement('a')
      a.setAttribute('href', 'javascript:window.__aux_pwned = true')
      a.textContent = 'tainted'
      $p[0].appendChild(a)
    })
    stubWindowOpen()
    dispatchAuxClick('#editor a')
    cy.get('@windowOpen').should('not.have.been.called')
    cy.window().should((w) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((w as any).__aux_pwned).to.be.undefined
    })
  })

  it('refuses to open file: hrefs (widened safety floor)', () => {
    cy.setEditorContent('<p>x</p>')
    cy.get('#editor p').then(($p) => {
      const a = document.createElement('a')
      a.setAttribute('href', 'file:///etc/passwd')
      a.textContent = 'file'
      $p[0].appendChild(a)
    })
    stubWindowOpen()
    dispatchAuxClick('#editor a')
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('refuses to open blob: hrefs (widened safety floor)', () => {
    cy.setEditorContent('<p>x</p>')
    cy.get('#editor p').then(($p) => {
      const a = document.createElement('a')
      a.setAttribute('href', 'blob:https://evil.example/abc')
      a.textContent = 'blob'
      $p[0].appendChild(a)
    })
    stubWindowOpen()
    dispatchAuxClick('#editor a')
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('does NOT intercept right-click (button=2) so the native context menu still works', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    stubWindowOpen()
    cy.get('#editor a').then(($el) => {
      const target = $el[0]
      target.dispatchEvent(
        new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 })
      )
    })
    cy.get('@windowOpen').should('not.have.been.called')
  })
})
