/// <reference types="cypress" />

/**
 * Support file for the extension-placeholder clean-room E2E suite.
 * Single file on purpose — Cypress 15's JIT loader silently skips
 * extensionless split imports.
 */

import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

import 'cypress-real-events'

declare global {
  interface Window {
    _editor: Editor
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      visitPlayground(query?: string): Chainable<void>
      getEditor(): Chainable<Editor>
      setEditorContent(html: string): Chainable<void>
      caretInBlock(index: number): Chainable<void>
      caretInEmptyTextblock(): Chainable<void>
      pasteHTML(html: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('visitPlayground', (query = '') => {
  cy.visit(`/${query}`)
  cy.window({ timeout: 10000 }).should('have.property', '_editor')
  cy.window().its('_editor').should('be.an', 'object')
})

Cypress.Commands.add('getEditor', () => cy.window().its('_editor'))

Cypress.Commands.add('setEditorContent', (html: string) => {
  cy.getEditor().then((editor) => {
    editor.commands.setContent(html)
  })
})

// Caret into the start of the nth top-level block.
Cypress.Commands.add('caretInBlock', (index: number) => {
  cy.getEditor().then((editor) => {
    let pos: number | undefined
    let i = 0
    editor.state.doc.forEach((_node, offset) => {
      if (i === index) pos = offset + 1
      i += 1
    })
    if (pos === undefined) throw new Error(`caretInBlock: no block at index ${index}`)
    editor.chain().focus().setTextSelection(pos).run()
  })
})

// Caret into the first empty textblock anywhere in the doc (handles nesting).
Cypress.Commands.add('caretInEmptyTextblock', () => {
  cy.getEditor().then((editor) => {
    let pos: number | undefined
    editor.state.doc.descendants((node: PMNode, p: number) => {
      if (pos !== undefined) return
      if (node.isTextblock && node.content.size === 0) pos = p + 1
    })
    if (pos === undefined) throw new Error('caretInEmptyTextblock: none found')
    editor.chain().focus().setTextSelection(pos).run()
  })
})

// Dispatch a real paste the way ProseMirror's handlePaste expects (matches the
// hyperlink/inline-code suites). Set the caret/selection before calling.
Cypress.Commands.add('pasteHTML', (html: string) => {
  cy.window().then((win) => {
    const dt = new win.DataTransfer()
    dt.setData('text/html', html)
    cy.get('#editor [contenteditable="true"]').trigger('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    })
  })
})

export {}
