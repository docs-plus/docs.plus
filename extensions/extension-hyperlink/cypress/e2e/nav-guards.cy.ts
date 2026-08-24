/// <reference types="cypress" />

const SAFE_HREF = 'https://example.com/'
const SAFE_FEATURES = 'noopener,noreferrer'

const stubWindowOpen = (alias = 'windowOpen'): void => {
  cy.window().then((w) => {
    cy.stub(w, 'open').as(alias)
  })
}

// Native event, not cy.click(): ProseMirror's handleDOMEvents.click needs a
// real bubbling MouseEvent with coordinates for posAtCoords.
const dispatchPrimaryClick = (selector: string): void => {
  cy.get(selector).then(($el) => {
    const target = $el[0]
    const rect = target.getBoundingClientRect()
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      })
    )
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

describe('Navigation guards — read-only click fallback (no preview popover)', () => {
  // Published read-only doc shape: no popover factories + editable:false.
  // This is the ONLY path into clickHandler's gated window.open fallback.
  // Every other spec runs with a preview factory, so the branch would
  // otherwise regress silently and kill link navigation in read-only docs.
  beforeEach(() => {
    cy.visit('/?readonly=on&popover=none')
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
  })

  it('opens a plain-URL link via gated window.open on primary click in read-only mode', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    stubWindowOpen()
    dispatchPrimaryClick('#editor a')
    cy.get('@windowOpen').should('have.been.calledOnce')
    cy.get('@windowOpen').its('firstCall.args.0').should('equal', SAFE_HREF)
    cy.get('@windowOpen').its('firstCall.args.1').should('equal', '_blank')
    cy.get('@windowOpen').its('firstCall.args.2').should('equal', SAFE_FEATURES)
  })

  it('refuses to open an injected javascript: anchor on primary click in read-only mode', () => {
    cy.setEditorContent('<p>x</p>')
    cy.get('#editor p').then(($p) => {
      const a = document.createElement('a')
      a.setAttribute('href', 'javascript:window.__ro_pwned = true')
      a.textContent = 'tainted'
      $p[0].appendChild(a)
    })
    stubWindowOpen()
    dispatchPrimaryClick('#editor a')
    cy.get('@windowOpen').should('not.have.been.called')
    cy.window().should((w) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((w as any).__ro_pwned).to.be.undefined
    })
  })
})

// Module scope: keeps top-level consts out of the shared-global TS project.
export {}
