/// <reference types="cypress" />

/**
 * Support file for the extension-inline-code clean-room E2E suite.
 * Single file on purpose — Cypress 15's JIT loader silently skips
 * extensionless split imports.
 */

// Type-only: pulls the package's Commands augmentation (toggleInlineCode)
// into the Cypress TS program.
import type {} from '@docs.plus/extension-inline-code'
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
      selectText(text: string): Chainable<void>
      setCaretAfter(text: string): Chainable<void>
      toggleInlineCode(): Chainable<void>
      typeInEditor(text: string): Chainable<void>
      pressKey(key: string, modifiers?: KeyModifiers): Chainable<void>
      pasteData(format: string, value: string): Chainable<void>
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

Cypress.Commands.add('selectText', (text: string) => {
  cy.getEditor().then((editor) => {
    let from: number | undefined
    let to: number | undefined
    editor.state.doc.descendants((node: PMNode, pos: number) => {
      if (from !== undefined) return
      if (node.isText && node.text && node.text.includes(text)) {
        from = pos + node.text.indexOf(text)
        to = from + text.length
      }
    })
    if (from === undefined || to === undefined) throw new Error(`selectText: "${text}" not found`)
    editor.chain().focus().setTextSelection({ from, to }).run()
  })
})

Cypress.Commands.add('setCaretAfter', (text: string) => {
  cy.getEditor().then((editor) => {
    let pos: number | undefined
    editor.state.doc.descendants((node: PMNode, p: number) => {
      if (pos !== undefined) return
      if (node.isText && node.text && node.text.includes(text)) {
        pos = p + node.text.indexOf(text) + text.length
      }
    })
    if (pos === undefined) throw new Error(`setCaretAfter: "${text}" not found`)
    editor.chain().focus().setTextSelection(pos).run()
  })
})

// Toolbar-equivalent path: clicking the inline-code button runs this command.
Cypress.Commands.add('toggleInlineCode', () => {
  cy.getEditor().then((editor) => {
    editor.chain().focus().toggleInlineCode().run()
  })
})

// Real typing (cypress-real-events) so the input-rule pipeline fires — cy.type()
// does not drive it. Waits for focus instead of forcing it: callers focus via
// Tiptap commands whose DOM focus lands in a rAF, and a forced .focus() can win
// that race and reset the caret to the document start before realType runs.
Cypress.Commands.add('typeInEditor', (text: string) => {
  cy.get('#editor [contenteditable="true"]').should('have.focus')
  cy.realType(text)
})

type KeyModifiers = Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }>

// Dispatch a real keydown so ProseMirror's keymap runs (arrow exit, Enter,
// Backspace undoInputRule, Mod-e shortcuts). Letter keys need a keyCode: on
// mac Chrome w3c-keyname ignores `key` while a modifier is down.
Cypress.Commands.add('pressKey', (key: string, modifiers: KeyModifiers = {}) => {
  const keyCodes: Record<string, number> = {
    ArrowRight: 39,
    ArrowLeft: 37,
    Enter: 13,
    Backspace: 8
  }
  const keyCode = keyCodes[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined)
  cy.get('#editor [contenteditable="true"]').trigger('keydown', {
    key,
    code: key,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    ...modifiers
  })
})

// Dispatch a real paste the way ProseMirror's handlePaste expects (matches the
// hyperlink suite). Set the caret/selection before calling.
Cypress.Commands.add('pasteData', (format: string, value: string) => {
  cy.window().then((win) => {
    const dt = new win.DataTransfer()
    dt.setData(format, value)
    cy.get('#editor [contenteditable="true"]').trigger('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    })
  })
})

export {}
