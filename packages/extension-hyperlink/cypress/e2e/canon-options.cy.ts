/// <reference types="cypress" />

/**
 * Coverage for two `@tiptap/extension-link` v3 canon options that ship
 * with `@docs.plus/extension-hyperlink` v2 but were unpinned. Both are
 * opt-in (default `false`) so the absence of these tests previously
 * meant a future refactor could quietly regress either behavior. Pin
 * the contract here.
 */

describe('canon options — enableClickSelection + exitable', () => {
  describe('enableClickSelection: true', () => {
    beforeEach(() => {
      cy.visit('/?clickSelection=on')
      cy.window({ timeout: 10000 }).should('have.property', '_editor')
      cy.setEditorContent('<p>Visit <a href="https://example.com">Example</a> for more info.</p>')
    })

    it('selects the entire link mark range when the link is clicked', () => {
      cy.get('#editor a').click()
      cy.getEditor().then((editor) => {
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to)
        // The whole anchor text — not the caret position the legacy
        // click-handler would have left behind.
        expect(text).to.equal('Example')
      })
    })
  })

  describe('exitable: true', () => {
    beforeEach(() => {
      cy.visit('/?exitable=on')
      cy.window({ timeout: 10000 }).should('have.property', '_editor')
    })

    it('clears the hyperlink mark from storedMarks at the right edge so the next typed char is plain', () => {
      cy.setEditorContent('<p><a href="https://example.com">link</a></p>')

      cy.getEditor().then((editor) => {
        // Place caret at the right edge of the link mark.
        const docEnd = editor.state.doc.content.size
        editor
          .chain()
          .focus()
          .setTextSelection(docEnd - 1)
          .run()
      })

      // ArrowRight at the edge fires `exitMarkOnArrowRight` which clears
      // the hyperlink storedMark. Cypress dispatches a real `keydown` so
      // ProseMirror's keymap actually runs.
      cy.get('#editor [contenteditable="true"]').trigger('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        keyCode: 39,
        which: 39,
        bubbles: true
      })

      cy.getEditor().then((editor) => {
        editor.chain().insertContent('X').run()
      })

      // The original `<a>` keeps its inner text; the trailing `X` lives
      // outside the anchor — the plain-text mark exit worked.
      cy.get('#editor a').should('have.text', 'link')
      cy.get('#editor p').should('contain.text', 'linkX')
    })
  })
})

export {}
