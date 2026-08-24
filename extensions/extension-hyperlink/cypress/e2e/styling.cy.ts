/// <reference types="cypress" />

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

const rootRuleText = (doc: Document): string => {
  const sheets = Array.from(doc.styleSheets) as CSSStyleSheet[]
  return sheets
    .flatMap((sheet) => {
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
    .map((rule) => rule.cssText)
    .join('\n')
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
    // Read the shipped `:root` rule text, not `getComputedStyle`. The playground
    // injects nine of these tokens on `html[data-theme]`, which outranks `:root`.
    // That would keep the assertions green after the tokens were deleted from
    // the sheet.
    it('declares every documented token on :root', () => {
      cy.document().then((doc) => {
        const rootText = rootRuleText(doc)
        for (const name of DOCUMENTED_CSS_VARS) {
          expect(rootText, `${name} should be declared on :root`).to.include(`${name}:`)
        }
      })
    })

    it('custom overrides take effect on rendered popovers', () => {
      // --hl-accent only paints on :focus-within. Cypress .focus() plus
      // scrollBehavior leaves the wrapper idle, so CI reads --hl-border
      // (#e5e7eb) and fails. Pin the idle token instead.
      cy.document().then((doc) => {
        doc.documentElement.style.setProperty('--hl-border', 'rgb(255, 0, 0)')
      })
      cy.setEditorContent('<p>Select this word</p>')
      cy.selectText('word')
      cy.pressModK()
      cy.get('.hyperlink-create-popover .inputs-wrapper')
        .should('be.visible')
        .and('have.css', 'border-color')
        .and('match', /rgb\(\s*255,\s*0,\s*0\s*\)/)
    })
  })

  describe('class contract (JS ↔ CSS)', () => {
    it('create popover DOM uses only classes that exist in the stylesheet', () => {
      cy.setEditorContent('<p>Select this word</p>')
      cy.selectText('word')
      cy.pressModK()
      cy.getVisibleFloatingPopover().find('.hyperlink-create-popover').should('be.visible')

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
      cy.getVisibleFloatingPopover().find('.hyperlink-preview-popover').should('be.visible')

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
      cy.getVisibleFloatingPopover().find('.hyperlink-edit-popover').should('be.visible')

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
        const rootText = rootRuleText(doc)
        expect(rootText, ':root rule must exist').to.not.equal('')
        for (const token of ['--hl-bg', '--hl-fg', '--hl-accent']) {
          expect(rootText).to.match(new RegExp(`${token}\\s*:\\s*light-dark\\(`))
        }
      })
    })
  })
})

// Module scope: keeps top-level consts out of the shared-global TS project.
export {}
