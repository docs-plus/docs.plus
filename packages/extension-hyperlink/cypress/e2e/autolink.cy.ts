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
      // Defense-in-depth: the helper must NOT run emails through the
      // URL-normalization path. This would have been the regression
      // mode when fixing the `findLinks` href-clobber bug.
      typeThroughAutolink('hello@example.com')
      cy.editorFirstLinkHref().should('eq', 'mailto:hello@example.com')
    })

    it('emits tel:+E.164 for bare phone numbers (+4733378901)', () => {
      // E.164 phones are detected by the `findLinks` phone branch.
      // linkifyjs has no phone matcher (issue #133, open since 2016)
      // — without our explicit `isBarePhone` check, this autolink
      // never fires and the user is left with raw text.
      typeThroughAutolink('+4733378901')
      cy.editorFirstLinkHref().should('eq', 'tel:+4733378901')
    })

    it('canonicalizes formatted single-token phones (+1-555-123-4567 → tel:+15551234567)', () => {
      typeThroughAutolink('+1-555-123-4567')
      cy.editorFirstLinkHref().should('eq', 'tel:+15551234567')
    })

    it('does NOT autolink bare digit strings (5551234567 stays plain text)', () => {
      // No `+` → not E.164 → must stay plain text. Pins the absence
      // of false positives that would silently `tel:`-ify years,
      // ZIPs, and arbitrary numbers in prose.
      typeThroughAutolink('5551234567')
      cy.get('#editor a').should('not.exist')
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

  describe('code mark', () => {
    it('does NOT autolink URLs typed inside an inline code mark', () => {
      // Code-marked text is *content*, not a navigation target — a
      // URL there must round-trip verbatim. Pins the v2.x autolink
      // gate that consults `schema.marks.code` and skips ranges that
      // already carry it. Mirrors @tiptap/extension-link v3 canon.
      cy.getEditor().then((editor) => {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: 'example.com',
            marks: [{ type: 'code' }]
          })
          .insertContent(' ')
          .run()
      })
      cy.get('#editor a').should('not.exist')
      cy.get('#editor code').should('contain.text', 'example.com')
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

describe('shouldAutoLink veto — parity across autolink + paste-handler + paste-rule', () => {
  // Reload with a `shouldAutoLink: () => false` policy wired into the
  // extension. Without the veto, all three surfaces would autolink the
  // pasted/typed URL — these tests pin that the policy is honored
  // consistently across every entry point. Earlier the paste handler
  // plugin alone bypassed `shouldAutoLink` (regression mode).
  beforeEach(() => {
    cy.visit('/?shouldAutoLink=block')
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
    cy.setEditorContent('<p></p>')
  })

  it('autolink plugin: refuses to linkify on whitespace boundary', () => {
    cy.getEditor().then((editor) => {
      editor.chain().focus().insertContent('example.com').run()
    })
    cy.getEditor().then((editor) => {
      editor.chain().insertContent(' ').run()
    })
    cy.get('#editor a').should('not.exist')
  })

  it('paste handler: refuses to linkify pasted URL over a non-empty selection', () => {
    cy.setEditorContent('<p>replace word here</p>')
    cy.selectText('word')
    cy.window().then((win) => {
      const dt = new win.DataTransfer()
      dt.setData('text/plain', 'example.com')
      cy.get('#editor [contenteditable="true"]').trigger('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      })
    })
    cy.get('#editor a').should('not.exist')
  })

  it('paste rule (markPasteRule): refuses to linkify pasted URL inside a paragraph', () => {
    cy.window().then((win) => {
      const dt = new win.DataTransfer()
      dt.setData('text/plain', 'visit example.com today')
      cy.get('#editor [contenteditable="true"]').trigger('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      })
    })
    cy.get('#editor a').should('not.exist')
  })
})

// Make this file an ES module so the top-level `typeThroughAutolink`
// helper doesn't collide with the same identifier in
// `special-schemes.cy.ts` under Cypress's shared TS project.
export {}
