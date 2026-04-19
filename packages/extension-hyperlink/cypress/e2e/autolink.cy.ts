/// <reference types="cypress" />

/**
 * Autolink + paste consistency spec.
 *
 * Pins the contract that every write path produces the same stored href
 * for the same input. Before this spec existed:
 *   - Create popover → `https://google.com` (after normalizeHref was wired)
 *   - Autolink on space → `google.com` (bare — findLinks clobbered href)
 *   - Paste over selection → `http://google.com` (linkifyjs default)
 *
 * All three now route through `normalizeLinkifyHref` for URL matches and
 * trust linkifyjs's canonical href for non-URL matches (emails, etc.).
 */

// Insert the word and its trailing space in *separate* transactions so
// the autolink plugin sees the whitespace-trigger boundary on its own
// tick, the way per-keystroke typing would. A single atomic
// `insertContent('google.com ')` does still fire the plugin, but masks
// regressions where the `changedRange`-shape of per-keystroke input
// would differ (IME, composition-end, appendTransaction windowing).
const typeThroughAutolink = (text: string): void => {
  cy.getEditor().then((editor) => {
    editor.chain().focus().insertContent(text).run()
  })
  cy.getEditor().then((editor) => {
    editor.chain().insertContent(' ').run()
  })
}

describe('Autolink + paste — canonical href consistency', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  describe('autolink on whitespace', () => {
    it('upgrades bare domains to https:// (matches create popover behavior)', () => {
      typeThroughAutolink('google.com')
      cy.editorFirstLinkHref().should('eq', 'https://google.com')
    })

    it('preserves http:// when the user explicitly typed it', () => {
      typeThroughAutolink('http://example.com')
      cy.editorFirstLinkHref().should('eq', 'http://example.com')
    })

    it('emits mailto: for email matches (not https://user@...)', () => {
      // Defence-in-depth: the helper must NOT run emails through the
      // URL-normalization path. This would have been the regression
      // mode when fixing the `findLinks` href-clobber bug.
      typeThroughAutolink('hello@example.com')
      cy.editorFirstLinkHref().should('eq', 'mailto:hello@example.com')
    })

    it('strips trailing punctuation without eating linkifyjs scheme', () => {
      // `Visit google.com.` autolinks `google.com`, not `google.com.`.
      // Pins both the trailing-punct strip and the invariant that the
      // stored href keeps its scheme (would have been `https://google.com.`
      // if the punct-strip ran on the scheme-prefixed href verbatim).
      typeThroughAutolink('Visit google.com.')
      cy.editorFirstLinkHref().should('eq', 'https://google.com')
    })
  })

  describe('paste over selection', () => {
    it('upgrades bare-domain paste to https://', () => {
      cy.setEditorContent('<p>Replace this word with a link.</p>')
      cy.selectText('word')
      cy.window().then((win) => {
        const dt = new win.DataTransfer()
        dt.setData('text/plain', 'example.com')
        // `cy.trigger('paste')` routes through Cypress's event pipeline
        // (logging, retries) and targets the contenteditable the way
        // ProseMirror's `handlePaste` expects.
        cy.get('#editor [contenteditable="true"]').trigger('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        })
      })
      cy.editorFirstLinkHref().should('eq', 'https://example.com')
    })
  })
})
