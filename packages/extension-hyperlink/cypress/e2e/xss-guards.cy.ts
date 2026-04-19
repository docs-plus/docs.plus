/// <reference types="cypress" />

const PREVIEW = '.hyperlink-preview-popover'
const DANGEROUS = ['javascript:alert(1)', 'data:text/html,hi', 'vbscript:msgbox("x")']

describe('XSS guards — dangerous URL schemes blocked at every entry point', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  describe('parseHTML', () => {
    DANGEROUS.forEach((href) => {
      it(`strips <a href="${href}"> on document load`, () => {
        cy.setEditorContent(`<p>Hello <a href="${href}">click me</a>.</p>`)
        cy.get('#editor a').should('not.exist')
      })
    })
  })

  describe('markdown input rule', () => {
    DANGEROUS.forEach((href) => {
      it(`rejects [text](${href}) typed inline`, () => {
        cy.setEditorContent('<p></p>')
        cy.get('.ProseMirror').click().type(`[click me](${href}) `)
        cy.get('#editor a').should('not.exist')
      })
    })
  })

  describe('click handler window.open guard', () => {
    // parseHTML strips dangerous anchors, so to exercise the click-handler guard
    // we inject a raw anchor directly into the editor DOM (simulating a third-
    // party plugin that bypassed the schema). The guard must still refuse to
    // open it even though it is now a live <a>.
    it('ignores clicks on injected javascript: anchors', () => {
      cy.setEditorContent('<p>trigger</p>')
      cy.get('#editor p').then(($p) => {
        const a = document.createElement('a')
        a.setAttribute('href', 'javascript:window.__pwned = true')
        a.textContent = 'tainted'
        $p[0].appendChild(a)
      })

      const winOpen = cy.stub().as('windowOpen')
      cy.on('window:before:load', (w) => {
        w.open = winOpen as typeof w.open
      })

      cy.get('#editor a').click({ force: true })

      cy.get('@windowOpen').should('not.have.been.called')
      cy.window().should((w) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((w as any).__pwned).to.be.undefined
      })
    })
  })

  describe('preview popover', () => {
    it('refuses to call window.open when constructed with a dangerous href', () => {
      // parseHTML strips dangerous hrefs before they reach the document, so a
      // "real" preview can never be opened against one. This test exercises
      // the last line of defence — a preview instantiated directly against a
      // tampered anchor still refuses to navigate.
      cy.window().then((w) => {
        cy.stub(w, 'open').as('windowOpen')

        const mount = w.document.createElement('div')
        w.document.body.appendChild(mount)
        const tamperedAnchor = w.document.createElement('a')
        tamperedAnchor.setAttribute('href', 'javascript:alert(1)')

        const preview = w._hyperlink.previewHyperlinkPopover({
          editor: w._editor,
          link: tamperedAnchor,
          view: w._editor.view,
          linkCoords: { x: 0, y: 0, width: 10, height: 10 }
        })
        if (!preview) throw new Error('previewHyperlinkPopover returned null')
        mount.appendChild(preview)

        const anchor = preview.querySelector('a')
        if (!anchor) throw new Error('preview anchor not found')
        anchor.click()
      })
      cy.get('@windowOpen').should('not.have.been.called')
    })
  })

  describe('DANGEROUS_SCHEME_RE export', () => {
    it('is exported from the package and matches the documented schemes', () => {
      cy.window().then((w) => {
        const mod = w._hyperlink
        expect(mod).to.have.property('DANGEROUS_SCHEME_RE')
        // `instanceof RegExp` is flaky across realms (iframe vs window).
        // A structural check is both safer and more meaningful here.
        expect(typeof mod.DANGEROUS_SCHEME_RE.test).to.equal('function')
        expect(String(mod.DANGEROUS_SCHEME_RE)).to.match(/javascript.*data.*vbscript/i)

        expect(mod.DANGEROUS_SCHEME_RE.test('javascript:alert(1)')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('data:text/html,hi')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('vbscript:msgbox')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('https://example.com')).to.be.false
        expect(mod.DANGEROUS_SCHEME_RE.test('mailto:a@b.com')).to.be.false
      })
    })

    it('re-exports the prebuilt popovers and Hyperlink extension', () => {
      cy.window().then((w) => {
        const mod = w._hyperlink
        expect(mod.Hyperlink, 'Hyperlink').to.exist
        expect(mod.createHyperlinkPopover, 'createHyperlinkPopover').to.be.a('function')
        expect(mod.previewHyperlinkPopover, 'previewHyperlinkPopover').to.be.a('function')
      })
    })
  })
})
