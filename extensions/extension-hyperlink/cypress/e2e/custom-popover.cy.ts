/// <reference types="cypress" />

/**
 * Pins the BYO factory contract documented in README.md → "Custom popover
 * factories": the options shape (including forwarding of `validate` and
 * `attributes`), the floating-popover lifecycle, and the exported helpers
 * (`getDefaultController`, `validateURL`,
 * `DANGEROUS_SCHEME_RE`) that the README snippets call. The playground's
 * `?popover=custom` mode records every factory invocation on
 * `window._byo` so assertions target the live object graph.
 */

const BYO_CREATE = '.byo-create-popover'
const BYO_PREVIEW = '.byo-preview-popover'
const BYO_CLOSE = `${BYO_CREATE} .byo-close`
const BYO_REMOVE = `${BYO_PREVIEW} .byo-remove`

describe('BYO popover factories — README public contract', () => {
  beforeEach(() => {
    cy.visitPlayground({ popover: 'custom' })
  })

  describe('createHyperlink factory', () => {
    beforeEach(() => {
      cy.setEditorContent('<p>Select this word to create a link.</p>')
      cy.selectText('word')
    })

    it('receives the documented CreateHyperlinkOptions shape on Mod+K', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(BYO_CREATE).should('be.visible')

      cy.window().its('_byo.createCalls').should('have.length', 1)
      cy.window().then((win) => {
        const opts = win._byo!.createCalls[0]
        expect(opts.editor).to.equal(win._editor)
        expect(opts.extensionName).to.equal('hyperlink')
        expect(opts.attributes).to.be.an('object')
        // The extension must forward the exact `validate` function the
        // consumer configured — not wrap it, not replace it, not strip it.
        expect(opts.validate).to.equal(win._byo!.configuredValidate)
      })
    })

    it('forwards openCreateHyperlinkPopover attributes into CreateHyperlinkOptions.attributes', () => {
      // v2 split: `setHyperlink` writes the mark; the side-effecting
      // popover lives behind `openCreateHyperlinkPopover`. Mod+K calls
      // it with no args (attributes default to `{}`), so a literal
      // empty-object pass-through test is useless. Drive the command
      // from the spec with real attributes to prove the extension's
      // `attributes ?? {}` branch actually forwards.
      cy.window().then((win) => {
        win._editor.commands.openCreateHyperlinkPopover({ href: 'https://forwarded.example' })
      })
      cy.get(BYO_CREATE).should('be.visible')
      cy.window().its('_byo.createCalls').should('have.length', 1)
      cy.window().then((win) => {
        expect(win._byo!.createCalls[0].attributes).to.deep.equal({
          href: 'https://forwarded.example'
        })
      })
    })

    it('mounts the returned element inside the floating toolbar', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get('.floating-popover-content').find(BYO_CREATE).should('exist')
    })

    it('getDefaultController().close() invoked from the custom DOM closes the popover', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(BYO_CREATE).should('be.visible')
      cy.get(BYO_CLOSE).click()
      cy.get(BYO_CREATE).should('not.exist')
      cy.get('.floating-popover').should('not.exist')
    })

    it('dismisses on Escape once focus is inside the toolbar', () => {
      // Escape is bound to the toolbar root, so it only fires when focus is
      // inside — consumers focus their own content (the prebuilt popover
      // auto-focuses its input for the same reason).
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(BYO_CLOSE).focus().realPress('Escape')
      cy.get(BYO_CREATE).should('not.exist')
    })
  })

  describe('previewHyperlink factory', () => {
    beforeEach(() => {
      cy.setEditorContent('<p>Visit <a href="https://example.com">Example</a>.</p>')
    })

    it('receives the documented PreviewHyperlinkOptions shape on link click', () => {
      cy.get('#editor a').click()
      cy.get(BYO_PREVIEW).should('be.visible')

      cy.window().its('_byo.previewCalls').should('have.length', 1)
      cy.window().then((win) => {
        const opts = win._byo!.previewCalls[0]
        expect(opts.editor).to.equal(win._editor)
        expect(opts.link.tagName).to.equal('A')
        expect(opts.link.href).to.contain('example.com')
        expect(opts.attrs.href).to.equal('https://example.com')
        expect(typeof opts.nodePos).to.equal('number')
        // Same reference-equality guarantee as the create factory.
        expect(opts.validate).to.equal(win._byo!.configuredValidate)
      })
    })

    it('mounts the returned element inside the floating toolbar on click', () => {
      cy.get('#editor a').click()
      cy.get('.floating-popover-content').find(BYO_PREVIEW).should('exist')
    })

    it('Remove button closes the toolbar and unsets the link mark on the editor', () => {
      cy.get('#editor a').click()
      cy.get(BYO_REMOVE).click()

      // `getDefaultController().close()` from the factory tears down the whole popover.
      cy.get('.floating-popover').should('not.exist')

      // `editor.chain().unsetHyperlink().run()` strips the anchor, keeps the
      // text, and — critically — clears the mark from the editor's doc
      // state, not just the rendered DOM.
      cy.get('#editor a').should('not.exist')
      cy.get('#editor').should('contain.text', 'Example')
      cy.window().then((win) => {
        const markNames = new Set<string>()
        win._editor.state.doc.descendants((node) => {
          node.marks.forEach((m) => markNames.add(m.type.name))
        })
        expect(markNames.has('hyperlink'), 'hyperlink mark still present').to.equal(false)
      })
    })
  })

  describe('exported helpers referenced by the README', () => {
    it('getDefaultController().reposition(ref) repositions the active popover', () => {
      // README.md (under "Custom popover factories") promises:
      //   "Popover content can control the floating popover via
      //    getDefaultController().close() and getDefaultController().reposition(ref)".
      // This pins the second half of that sentence.
      cy.setEditorContent('<p>Select this word.</p>')
      cy.selectText('word')
      cy.get('body').realPress(['Meta', 'K'])
      cy.get('.floating-popover.visible').should('exist')

      cy.get('.floating-popover').then(($tb) => {
        const before = $tb[0].getBoundingClientRect()

        cy.window().then((win) => {
          const target = win.document.createElement('div')
          Object.assign(target.style, {
            position: 'fixed',
            left: '20px',
            top: '500px',
            width: '40px',
            height: '20px'
          })
          target.setAttribute('data-testid', 'byo-position-target')
          win.document.body.appendChild(target)
          win._hyperlink.getDefaultController().reposition(target)
        })

        cy.get('.floating-popover').should(($after) => {
          const after = $after[0].getBoundingClientRect()
          // placement is 'bottom', so the popover sits below the target
          // (top=500 + height=20 + offset≈8 = ~528). The pre-move position
          // was anchored to selected text near the top of the editor.
          expect(Math.abs(after.top - before.top)).to.be.greaterThan(100)
        })
      })
    })

    it('validateURL accepts standard URLs and composes with a customValidator', () => {
      cy.window().then((win) => {
        const { validateURL } = win._hyperlink
        expect(validateURL('https://example.com')).to.equal(true)
        expect(validateURL('')).to.equal(false)
        expect(validateURL('   ')).to.equal(false)
        expect(validateURL('https://example.com', { customValidator: () => false })).to.equal(false)
      })
    })

    it('DANGEROUS_SCHEME_RE tolerates case variance and leading whitespace', () => {
      // The base positive/negative matrix is owned by `xss-guards.cy.ts`.
      // This spec only pins the two tolerance rules that directly affect
      // anyone building their own validator from the README example.
      cy.window().then((win) => {
        const re = win._hyperlink.DANGEROUS_SCHEME_RE
        expect(re.test('JavaScript:alert(1)'), 'case-insensitive').to.equal(true)
        expect(re.test('  javascript:alert(1)'), 'leading whitespace').to.equal(true)
      })
    })
  })
})
