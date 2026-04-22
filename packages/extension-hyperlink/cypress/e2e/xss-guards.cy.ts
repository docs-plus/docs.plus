/// <reference types="cypress" />

// `blob:` test fixture intentionally has no embedded `https://` substring
// — otherwise the autolink plugin would linkify the inner URL on the
// trailing-space tick after the markdown input rule rejects the outer
// dangerous href, defeating the assertion. Real blob URLs follow this
// shape too (`blob:<origin>/<uuid>`); the assertion here is on scheme
// blocking, not on URL embedding.
const DANGEROUS = [
  'javascript:alert(1)',
  'data:text/html,hi',
  'vbscript:msgbox("x")',
  'file:///etc/passwd',
  'blob:abc-123-uuid'
]

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

  describe('renderHTML re-validation', () => {
    // `parseHTML` strips dangerous schemes on document load and every
    // write boundary refuses them, but a hostile mark can still reach
    // `renderHTML` through Yjs op replay, raw `addMark` from a downstream
    // extension, or schema migrations from older versions. The mark
    // serializer must blank the `href` on serialize so a bad mark in
    // the doc never round-trips into a clickable dangerous anchor
    // downstream — matches `@tiptap/extension-link` v3 canon.
    DANGEROUS.forEach((href) => {
      it(`blanks href="${href}" when serialized via getHTML()`, () => {
        cy.setEditorContent('<p>tainted</p>')
        cy.window().then((w) => {
          const editor = w._editor
          const { state } = editor.view
          const markType = state.schema.marks.hyperlink
          // Bypass every write-boundary gate by going straight to the
          // transaction. This is the worst-case shape `renderHTML` has
          // to defend against (collab replay, downstream extension).
          const tr = state.tr.addMark(1, state.doc.content.size, markType.create({ href }))
          editor.view.dispatch(tr)
          const html = editor.getHTML()
          // The anchor must render with an empty `href` attribute, not
          // the dangerous URL — `<a href="">tainted</a>` is the contract.
          expect(html).to.match(/<a\s[^>]*href=""/)
          expect(html).not.to.include(href)
        })
      })
    })
  })

  describe('preview popover', () => {
    it('refuses to call window.open when constructed with a dangerous href', () => {
      // parseHTML strips dangerous hrefs before they reach the document, so a
      // "real" preview can never be opened against one. This test exercises
      // the last line of defense — a preview instantiated directly against a
      // tampered anchor still refuses to navigate.
      cy.window().then((w) => {
        cy.stub(w, 'open').as('windowOpen')

        const mount = w.document.createElement('div')
        w.document.body.appendChild(mount)
        const tamperedAnchor = w.document.createElement('a')
        tamperedAnchor.setAttribute('href', 'javascript:alert(1)')

        // Intentionally omit `nodePos`/`attrs` to exercise the
        // `link.getAttribute('href')` fallback inside the popover. The
        // public type marks both required because the production call
        // sites always supply them; cast here to bypass the check
        // for the fallback test.
        const preview = w._hyperlink.previewHyperlinkPopover({
          editor: w._editor,
          link: tamperedAnchor,
          view: w._editor.view,
          linkCoords: { x: 0, y: 0, width: 10, height: 10 }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        if (!preview) throw new Error('previewHyperlinkPopover returned null')
        mount.appendChild(preview)

        const anchor = preview.querySelector('a')
        if (!anchor) throw new Error('preview anchor not found')
        anchor.click()
      })
      cy.get('@windowOpen').should('not.have.been.called')
    })
  })

  describe('public package exports', () => {
    it('exposes DANGEROUS_SCHEME_RE matching the documented schemes', () => {
      cy.window().then((w) => {
        const mod = w._hyperlink
        expect(mod).to.have.property('DANGEROUS_SCHEME_RE')
        // `instanceof RegExp` is flaky across realms (iframe vs window).
        // A structural check is both safer and more meaningful here.
        expect(typeof mod.DANGEROUS_SCHEME_RE.test).to.equal('function')
        expect(String(mod.DANGEROUS_SCHEME_RE)).to.match(/javascript.*data.*vbscript.*file.*blob/i)

        expect(mod.DANGEROUS_SCHEME_RE.test('javascript:alert(1)')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('data:text/html,hi')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('vbscript:msgbox')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('file:///etc/passwd')).to.be.true
        expect(mod.DANGEROUS_SCHEME_RE.test('blob:https://evil.example/abc')).to.be.true
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

// Make this file an ES module so its top-level identifiers don't collide
// with same-named identifiers in sibling specs under Cypress's shared TS
// project.
export {}
