/// <reference types="cypress" />

/**
 * History integration — autolink and the preview popover's Remove must
 * behave as clean undo/redo steps: undoing an autolink keeps the typed
 * text, redo restores the canonical href, and Remove reverts in one step.
 */

// Type-only: pulls StarterKit's undo/redo command augmentation into this
// isolated Cypress TS project (erased at runtime).
import type {} from '@tiptap/starter-kit'

const HISTORY_GROUP_GAP_MS = 700

// Two-transaction autolink trigger (same shape as autolink.cy.ts), with a
// real pause between the word and the trailing space so prosemirror-history
// (newGroupDelay 500ms) records them as separate undo events — the space +
// appended autolink mark form their own step, the way paused typing does.
const typeThenAutolink = (text: string): void => {
  cy.getEditor().then((editor) => {
    editor.chain().focus().insertContent(text).run()
  })
  cy.wait(HISTORY_GROUP_GAP_MS)
  cy.getEditor().then((editor) => {
    editor.chain().insertContent(' ').run()
  })
}

describe('undo / redo — autolink and popover actions', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
  })

  it('a single undo after autolink removes the mark, keeps the text, and the next typed char is unmarked', () => {
    typeThenAutolink('google.com')
    cy.editorFirstLinkHref().should('eq', 'https://google.com')

    cy.getEditor().then((editor) => {
      editor.commands.undo()
    })
    cy.get('#editor a').should('not.exist')
    cy.get('#editor p').should('contain.text', 'google.com')

    // The undone mark must not linger in storedMarks: the next typed
    // character lands as plain text, not as a resurrected link.
    cy.getEditor().then((editor) => {
      editor.commands.focus('end')
    })
    cy.realType('x')
    cy.get('#editor a').should('not.exist')
    cy.get('#editor p').invoke('text').should('contain', 'google.comx')
  })

  it('redo restores the canonical https:// href produced by autolink', () => {
    typeThenAutolink('google.com')
    cy.editorFirstLinkHref().should('eq', 'https://google.com')

    cy.getEditor().then((editor) => {
      editor.commands.undo()
    })
    cy.get('#editor a').should('not.exist')

    cy.getEditor().then((editor) => {
      editor.commands.redo()
    })
    cy.editorFirstLinkHref().should('eq', 'https://google.com')
  })

  it('preview-popover Remove reverts with a single undo', () => {
    cy.setEditorContent('<p>Visit <a href="https://example.com">Example</a> now.</p>')
    cy.get('#editor a').click()
    cy.get('.hyperlink-preview-popover .remove').click()
    cy.get('#editor a').should('not.exist')

    cy.getEditor().then((editor) => {
      editor.commands.undo()
    })
    cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
    cy.get('#editor a').should('contain.text', 'Example')
  })
})

export {}
