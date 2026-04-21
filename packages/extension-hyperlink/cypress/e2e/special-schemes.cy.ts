/// <reference types="cypress" />

/**
 * Pins deep-link / special-scheme support end-to-end.
 *
 * The library claims (in README + `specialUrls.ts`) to autolink and accept
 * 50+ app schemes (whatsapp:, tg:, github:, vscode:, …) and a curated set
 * of domain mappings (wa.me, t.me, github.com, …). The unit tests cover
 * the catalog itself; this spec proves the editor actually produces the
 * right `<a href>` for those inputs through the same write paths an end
 * user would touch:
 *
 *   1. Autolink on whitespace (`SPECIAL_SCHEME_REGEX_GLOBAL` branch in
 *      `src/plugins/autolink.ts`).
 *   2. Create popover (`Mod+K` → submit) — runs through `normalizeHref`
 *      and `validateURL`.
 *   3. Standard linkifyjs path for domain-mapped web URLs.
 */

const POPOVER = '.hyperlink-create-popover'
const INPUT = `${POPOVER} input[name="hyperlink-url"]`
const WRAPPER = `${POPOVER} .inputs-wrapper`

// Mirrors the helper in `autolink.cy.ts`: insert the URL and the
// trailing space in *separate* transactions so the autolink plugin sees
// the whitespace-trigger boundary on its own tick (matches per-keystroke
// typing more faithfully than a single atomic `insertContent`).
const typeThroughAutolink = (text: string): void => {
  cy.getEditor().then((editor) => {
    editor.chain().focus().insertContent(text).run()
  })
  cy.getEditor().then((editor) => {
    editor.chain().insertContent(' ').run()
  })
}

describe('Deep links and domain mappings — autolink + create popover', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  describe('autolink on whitespace — app deep-link schemes', () => {
    // The `SPECIAL_SCHEME_REGEX_GLOBAL` branch is the only thing that
    // makes these autolink — linkifyjs alone never picks up
    // `whatsapp://…`. A regression in that branch (or in `validateURL`)
    // would fail these as silent no-ops (text but no `<a>`).
    const cases: { label: string; url: string }[] = [
      { label: 'whatsapp://', url: 'whatsapp://send?text=hello' },
      { label: 'tg://', url: 'tg://msg?to=foo' },
      { label: 'github://', url: 'github://repo/owner/name' },
      { label: 'vscode://', url: 'vscode://file/Users/foo/bar.ts' },
      { label: 'slack://', url: 'slack://open' }
    ]
    for (const { label, url } of cases) {
      it(`autolinks ${label} preserving the original scheme verbatim`, () => {
        typeThroughAutolink(url)
        cy.editorFirstLinkHref().should('eq', url)
      })
    }
  })

  describe('autolink on whitespace — domain mappings (standard linkify path)', () => {
    // These ride the regular linkifyjs pipeline (real http(s) URL with a
    // host that happens to live in DOMAIN_MAPPINGS). Asserting they keep
    // the user-typed scheme is a regression-pin for `normalizeLinkifyHref`
    // — the helper must NOT downgrade `https://` or rewrite the host.
    const cases: { label: string; url: string }[] = [
      { label: 'wa.me', url: 'https://wa.me/15551234567' },
      { label: 't.me', url: 'https://t.me/durov' },
      { label: 'github.com', url: 'https://github.com/docs-plus/docs.plus' },
      { label: 'meet.google.com', url: 'https://meet.google.com/abc-defg-hij' }
    ]
    for (const { label, url } of cases) {
      it(`autolinks ${label} keeping the explicit https:// the user typed`, () => {
        typeThroughAutolink(url)
        cy.editorFirstLinkHref().should('eq', url)
      })
    }

    it('upgrades a bare wa.me/<phone> to https:// (matches create popover)', () => {
      // Bare-domain inputs are normalized to https:// by `normalizeHref`
      // — pinned here for deep-link domains too, not just generic web hosts.
      typeThroughAutolink('wa.me/15551234567')
      cy.editorFirstLinkHref().should('eq', 'https://wa.me/15551234567')
    })
  })

  describe('create popover — accepts deep-link schemes verbatim', () => {
    beforeEach(() => {
      cy.setEditorContent('<p>Select this target word to apply a link.</p>')
      cy.selectText('target')
    })

    const cases: { label: string; url: string }[] = [
      { label: 'whatsapp://', url: 'whatsapp://send?text=hello' },
      { label: 'tg://', url: 'tg://msg?to=foo' },
      { label: 'github://', url: 'github://repo/owner/name' },
      { label: 'vscode://', url: 'vscode://file/Users/foo/bar.ts' }
    ]
    for (const { label, url } of cases) {
      it(`stores ${label} as-is (no https:// prefix, no normalization)`, () => {
        cy.get('body').realPress(['Meta', 'K'])
        cy.get(INPUT).type(`${url}{enter}`)
        cy.get(POPOVER).should('not.exist')
        cy.editorFirstLinkHref().should('eq', url)
      })
    }
  })

  describe('create popover — rejects unknown / dangerous schemes', () => {
    beforeEach(() => {
      cy.setEditorContent('<p>Select this target word to apply a link.</p>')
      cy.selectText('target')
    })

    it('rejects an unregistered scheme (foo://bar)', () => {
      // Defence-in-depth: only the catalog in `specialUrls.ts` should
      // wave non-web schemes through. Anything else must trip the
      // `inputs-wrapper.error` branch and not create an `<a>`.
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('foo://bar{enter}')
      cy.get(POPOVER).should('be.visible')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get('#editor a').should('not.exist')
    })

    it('rejects javascript: (XSS vector)', () => {
      cy.get('body').realPress(['Meta', 'K'])
      cy.get(INPUT).type('javascript:alert(1){enter}')
      cy.get(POPOVER).should('be.visible')
      cy.get(WRAPPER).should('have.class', 'error')
      cy.get('#editor a').should('not.exist')
    })
  })
})
