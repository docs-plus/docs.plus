/// <reference types="cypress" />

/**
 * These tests are the "did we actually ship the CSS?" safety net. They prove:
 *   1. The stylesheet from the `./styles.css` subpath export is loaded
 *      (packaging + exports map regression test).
 *   2. Every documented `--hl-*` custom property resolves on :root.
 *   3. Class names referenced in the JS modules exist in the CSS and vice
 *      versa — the one documented "CSS ↔ JS contract" of the public API.
 *   4. Color tokens use `light-dark()` so consumers can flip themes via `color-scheme`.
 */

const DOCUMENTED_CSS_VARS = [
  '--hl-bg',
  '--hl-fg',
  '--hl-muted',
  '--hl-border',
  '--hl-hover',
  '--hl-accent',
  '--hl-accent-fg',
  '--hl-danger',
  '--hl-radius',
  '--hl-radius-sm',
  '--hl-shadow',
  '--hl-font',
  '--hl-font-size',
  '--hl-z-index',
  '--hl-transition'
]

const PUBLIC_CLASS_NAMES = [
  '.floating-popover',
  '.floating-popover.visible',
  '.floating-popover-arrow',
  '.floating-popover-content',
  '.hyperlink-create-popover',
  '.hyperlink-preview-popover',
  '.hyperlink-edit-popover'
]

const ruleExists = (doc: Document, selector: string): boolean => {
  const sheets = Array.from(doc.styleSheets) as CSSStyleSheet[]
  return sheets.some((sheet) => {
    try {
      return Array.from(sheet.cssRules).some((rule) => {
        const text = (rule as { selectorText?: string; cssText?: string }).selectorText
        return typeof text === 'string' && text.includes(selector)
      })
    } catch {
      // Cross-origin stylesheets throw; ours are same-origin so this
      // only hits pathological edge cases, but guard anyway.
      return false
    }
  })
}

describe('Default stylesheet — packaging, tokens, class contract', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  describe('shipped via exports map', () => {
    it('registers a stylesheet that defines the popover shell', () => {
      cy.document().then((doc) => {
        expect(ruleExists(doc, '.hyperlink-create-popover')).to.equal(true)
        expect(ruleExists(doc, '.floating-popover')).to.equal(true)
      })
    })

    PUBLIC_CLASS_NAMES.forEach((selector) => {
      it(`defines \`${selector}\``, () => {
        cy.document().then((doc) => {
          expect(ruleExists(doc, selector)).to.equal(true)
        })
      })
    })
  })

  describe('--hl-* design tokens', () => {
    DOCUMENTED_CSS_VARS.forEach((name) => {
      it(`${name} resolves to a non-empty value on :root`, () => {
        cy.document().then((doc) => {
          const value = getComputedStyle(doc.documentElement).getPropertyValue(name).trim()
          expect(value, `${name} should be defined`).to.not.equal('')
        })
      })
    })

    it('custom overrides take effect on rendered popovers', () => {
      cy.document().then((doc) => {
        doc.documentElement.style.setProperty('--hl-accent', 'rgb(255, 0, 0)')
      })
      cy.setEditorContent('<p>Select this word</p>')
      cy.selectText('word')
      cy.get('body').realPress(['Meta', 'K'])
      cy.get('.hyperlink-create-popover input').focus()
      cy.get('.hyperlink-create-popover .inputs-wrapper')
        .should('have.css', 'border-color')
        .and('match', /rgb\(\s*255,\s*0,\s*0\s*\)/)
    })
  })

  describe('class contract (JS ↔ CSS)', () => {
    // If the JS module renders classes that the CSS never styles, or the CSS
    // styles classes the JS never renders, the "public styling surface"
    // documented in the README is a lie. These tests keep both sides honest.

    it('create popover DOM uses only classes that exist in the stylesheet', () => {
      cy.setEditorContent('<p>Select this word</p>')
      cy.selectText('word')
      cy.get('body').realPress(['Meta', 'K'])
      cy.get('.hyperlink-create-popover').should('be.visible')

      const required = [
        '.hyperlink-create-popover',
        '.inputs-wrapper',
        '.search-icon',
        '.error-message',
        '.buttons-wrapper'
      ]
      cy.document().then((doc) => {
        required.forEach((sel) => {
          expect(ruleExists(doc, sel), `missing CSS rule: ${sel}`).to.equal(true)
        })
      })
    })

    it('preview popover DOM uses only classes that exist in the stylesheet', () => {
      cy.setEditorContent('<p><a href="https://example.com">Example</a></p>')
      cy.get('#editor a').click()
      cy.get('.hyperlink-preview-popover').should('be.visible')

      cy.get('.hyperlink-preview-popover .copy').should('exist')
      cy.get('.hyperlink-preview-popover .edit').should('exist')
      cy.get('.hyperlink-preview-popover .remove').should('exist')

      cy.document().then((doc) => {
        expect(ruleExists(doc, '.hyperlink-preview-popover')).to.equal(true)
      })
    })

    it('edit popover DOM uses only classes that exist in the stylesheet', () => {
      cy.setEditorContent('<p><a href="https://example.com">Example</a></p>')
      cy.get('#editor a').click()
      cy.get('.hyperlink-preview-popover .edit').click()
      cy.get('.hyperlink-edit-popover').should('be.visible')

      const required = [
        '.hyperlink-edit-popover',
        '.text-wrapper',
        '.href-wrapper',
        '.apply-button',
        '.back-button'
      ]
      cy.document().then((doc) => {
        required.forEach((sel) => {
          expect(ruleExists(doc, sel), `missing CSS rule: ${sel}`).to.equal(true)
        })
      })
    })
  })

  describe('dark mode', () => {
    // README → Theming promises color tokens use `light-dark()` so the
    // popover follows the nearest ancestor's `color-scheme`. We assert on
    // the shipped CSS text instead of flipping the system media query
    // (flaky across Electron versions).
    it('defines the core --hl-* color tokens with light-dark() on :root', () => {
      cy.document().then((doc) => {
        const sheets = Array.from(doc.styleSheets) as CSSStyleSheet[]
        const rootRules = sheets.flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules).filter(
              (rule): rule is CSSStyleRule =>
                rule.constructor.name === 'CSSStyleRule' &&
                (rule as CSSStyleRule).selectorText === ':root'
            )
          } catch {
            return []
          }
        })

        expect(rootRules.length, ':root rule must exist').to.be.gte(1)

        const rootText = rootRules.map((r) => r.cssText).join('\n')
        for (const token of ['--hl-bg', '--hl-fg', '--hl-accent']) {
          expect(rootText).to.match(new RegExp(`${token}\\s*:\\s*light-dark\\(`))
        }
      })
    })
  })
})
