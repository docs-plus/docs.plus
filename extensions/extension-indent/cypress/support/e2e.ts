/// <reference types="cypress" />

/**
 * Support file for the extension-indent clean-room E2E suite.
 * Single file on purpose — Cypress 15's JIT loader silently skips
 * extensionless split imports.
 */

import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

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
      setCaretInText(text: string, offset?: number): Chainable<void>
      selectAcross(firstText: string, lastText: string): Chainable<void>
      pressKey(key: string, opts?: { shift?: boolean }): Chainable<void>
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

// Collapsed caret `offset` chars into the first text node containing `text`.
Cypress.Commands.add('setCaretInText', (text: string, offset = 0) => {
  cy.getEditor().then((editor) => {
    let pos: number | undefined
    editor.state.doc.descendants((node: PMNode, p: number) => {
      if (pos !== undefined) return
      if (node.isText && node.text && node.text.includes(text)) {
        pos = p + node.text.indexOf(text) + offset
      }
    })
    if (pos === undefined) throw new Error(`setCaretInText: "${text}" not found`)
    editor.chain().focus().setTextSelection(pos).run()
  })
})

// Select from the START of the first textblock containing `firstText` to the
// END of the last textblock containing `lastText` — full lines, so outdent
// sees leading indents the caller created via Tab.
Cypress.Commands.add('selectAcross', (firstText: string, lastText: string) => {
  cy.getEditor().then((editor) => {
    let from: number | undefined
    let to: number | undefined
    editor.state.doc.descendants((node: PMNode, pos: number) => {
      if (!node.isTextblock) return
      if (from === undefined && node.textContent.includes(firstText)) from = pos + 1
      if (node.textContent.includes(lastText)) to = pos + 1 + node.content.size
    })
    if (from === undefined || to === undefined) {
      throw new Error(`selectAcross: "${firstText}".."${lastText}" not found`)
    }
    editor.chain().focus().setTextSelection({ from, to }).run()
  })
})

// Dispatch a real keydown so ProseMirror's keymap runs — Cypress `.type('{Tab}')`
// does not reliably reach the keymap for Tab/arrow handlers.
Cypress.Commands.add('pressKey', (key: string, opts: { shift?: boolean } = {}) => {
  const keyCodes: Record<string, number> = { Tab: 9, ArrowLeft: 37, ArrowRight: 39, Enter: 13 }
  cy.get('#editor [contenteditable="true"]').trigger('keydown', {
    key,
    code: key,
    keyCode: keyCodes[key],
    which: keyCodes[key],
    shiftKey: Boolean(opts.shift),
    bubbles: true,
    cancelable: true
  })
})

export {}
