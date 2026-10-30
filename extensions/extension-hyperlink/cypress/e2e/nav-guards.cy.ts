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
const dispatchPrimaryClick = (selector: string, init: MouseEventInit = {}): void => {
  cy.get(selector).then(($el) => {
    const target = $el[0]
    const rect = target.getBoundingClientRect()
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        ...init
      })
    )
  })
}

// Mod is Meta on macOS and Ctrl elsewhere, as `isMacOS()` decides in the extension.
const IS_MAC = Cypress.platform === 'darwin'
const MOD_KEY = IS_MAC ? 'Meta' : 'Control'
const MOD_FLAGS = { metaKey: IS_MAC, ctrlKey: !IS_MAC }

const dispatchKey = (type: 'keydown' | 'keyup', init: KeyboardEventInit): void => {
  cy.document().then((doc) => {
    doc.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }))
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

interface NavigateCall {
  href: string
  newTab: boolean
}

// `?navigate=spy` makes the playground record each host `navigate` call here.
const navigateCalls = (): Cypress.Chainable<NavigateCall[]> =>
  cy.window().its('_navigateCalls') as Cypress.Chainable<NavigateCall[]>

const appendTaintedAnchor = (href: string): void => {
  cy.get('#editor p').then(($p) => {
    const a = document.createElement('a')
    a.setAttribute('href', href)
    a.textContent = 'tainted'
    $p[0].appendChild(a)
  })
}

describe('Navigation guards — host navigate option (?navigate=spy)', () => {
  beforeEach(() => {
    cy.visitPlayground({ query: 'navigate=spy' })
  })

  it('routes a middle click through navigate with newTab: true', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    stubWindowOpen()
    dispatchAuxClick('#editor a')
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: true }])
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('never calls navigate for an injected javascript: anchor', () => {
    cy.setEditorContent('<p>x</p>')
    appendTaintedAnchor('javascript:window.__nav_pwned = true')
    stubWindowOpen()
    dispatchAuxClick('#editor a')
    navigateCalls().should('deep.equal', [])
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('routes the prebuilt preview Open through navigate with newTab: false', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    cy.get('#editor a').click()
    stubWindowOpen()
    cy.get('.hyperlink-preview-popover a').click()
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: false }])
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('routes a middle click on the preview Open through navigate with newTab: true', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    cy.get('#editor a').click()
    stubWindowOpen()
    dispatchAuxClick('.hyperlink-preview-popover a')
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: true }])
    cy.get('@windowOpen').should('not.have.been.called')
  })
})

describe('Navigation guards — preview Open with a strict host gate (?gate=strict)', () => {
  const BLOCKED_HREF = 'https://blocked.example/'

  beforeEach(() => {
    cy.visitPlayground({ query: 'navigate=spy&gate=strict' })
  })

  // A real middle click follows the anchor's own href, so a refused link must not carry one.
  it('gives a refused link no Open href and makes no navigate call on a middle click', () => {
    cy.setEditorContent(`<p><a href="${BLOCKED_HREF}">blocked</a></p>`)
    cy.get('#editor a').click()
    cy.get('.hyperlink-preview-popover a').should('have.text', BLOCKED_HREF)
    cy.get('.hyperlink-preview-popover a').should('not.have.attr', 'href', BLOCKED_HREF)
    stubWindowOpen()
    dispatchAuxClick('.hyperlink-preview-popover a')
    cy.get('.hyperlink-preview-popover a').click()
    navigateCalls().should('deep.equal', [])
    cy.get('@windowOpen').should('not.have.been.called')
  })
})

describe('Navigation guards — read-only click with host navigate', () => {
  beforeEach(() => {
    cy.visit('/?readonly=on&popover=none&navigate=spy')
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
  })

  it('routes a primary click through navigate with newTab: false', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    stubWindowOpen()
    dispatchPrimaryClick('#editor a')
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: false }])
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('never calls navigate for an injected javascript: anchor', () => {
    cy.setEditorContent('<p>x</p>')
    appendTaintedAnchor('javascript:window.__nav_ro_pwned = true')
    stubWindowOpen()
    dispatchPrimaryClick('#editor a')
    navigateCalls().should('deep.equal', [])
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('routes a Mod-click through navigate exactly once', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    stubWindowOpen()
    dispatchPrimaryClick('#editor a', MOD_FLAGS)
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: true }])
    cy.get('@windowOpen').should('not.have.been.called')
  })
})

describe('Navigation guards — Mod-click (?navigate=spy)', () => {
  beforeEach(() => {
    cy.visitPlayground({ query: 'navigate=spy' })
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
  })

  it('opens a Mod-click in a new tab with no preview', () => {
    stubWindowOpen()
    dispatchPrimaryClick('#editor a', MOD_FLAGS)
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: true }])
    cy.get('.hyperlink-preview-popover').should('not.exist')
    cy.get('@windowOpen').should('not.have.been.called')
  })

  it('opens the preview on a plain click, not a new tab', () => {
    dispatchPrimaryClick('#editor a')
    cy.get('.hyperlink-preview-popover').should('be.visible')
    navigateCalls().should('deep.equal', [])
  })
})

describe('Navigation guards — Mod-click in read-only mode with the preview', () => {
  beforeEach(() => {
    cy.visit('/?readonly=on&navigate=spy')
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
  })

  it('routes a Mod-click through navigate exactly once, with no preview', () => {
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    dispatchPrimaryClick('#editor a', MOD_FLAGS)
    navigateCalls().should('deep.equal', [{ href: SAFE_HREF, newTab: true }])
    cy.get('.hyperlink-preview-popover').should('not.exist')
  })
})

describe('Mod cursor — links show the hand only while Mod is held', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent(`<p><a href="${SAFE_HREF}">link</a></p>`)
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })

  it('shows the hand on Mod keydown and drops it on keyup', () => {
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    dispatchKey('keyup', { key: MOD_KEY })
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })

  it('drops the hand on window blur', () => {
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    cy.window().then((w) => w.dispatchEvent(new Event('blur')))
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })

  it('drops the hand on visibilitychange', () => {
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    cy.document().then((doc) => doc.dispatchEvent(new Event('visibilitychange')))
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })

  it('drops the hand on a non-modifier key, such as Mod+K, and keeps it off on its keyup', () => {
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    dispatchKey('keydown', { key: 'k', ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'text')
    dispatchKey('keyup', { key: 'k', ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })

  it('keeps the hand when Shift is released while Mod is still held', () => {
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS })
    dispatchKey('keydown', { key: 'Shift', shiftKey: true, ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    dispatchKey('keyup', { key: 'Shift', ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
  })

  it('ignores a repeated Mod keydown after Mod+K dropped the hand', () => {
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    dispatchKey('keydown', { key: 'k', ...MOD_FLAGS })
    cy.get('#editor a').should('have.css', 'cursor', 'text')
    dispatchKey('keydown', { key: MOD_KEY, ...MOD_FLAGS, repeat: true })
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })

  it('syncs from the pointer when it enters a link', () => {
    cy.get('#editor a').then(($a) => {
      $a[0].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, ...MOD_FLAGS }))
    })
    cy.get('#editor a').should('have.css', 'cursor', 'pointer')
    cy.get('#editor a').then(($a) => {
      $a[0].dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
    })
    cy.get('#editor a').should('have.css', 'cursor', 'text')
  })
})

// Module scope: keeps top-level consts out of the shared-global TS project.
export {}
