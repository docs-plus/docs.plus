/// <reference types="cypress" />

/**
 * Single file on purpose — Cypress 15's JIT loader silently skips
 * extensionless split imports.
 */

// Type-only: pulls the package's Commands augmentation (insertMermaid)
// into the Cypress TS program.
import type { MermaidView } from '@docs.plus/extension-mermaid'
import { registerPlaygroundMarkdownCommands } from '@docs.plus/playground/cypress/markdownCommands'
import type { Editor } from '@tiptap/core'
import 'cypress-real-events'

registerPlaygroundMarkdownCommands()

declare global {
  interface Window {
    _editor: Editor
    _customViews: MermaidView['dom'][]
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      visitPlayground(query?: string): Chainable<void>
      getEditor(): Chainable<Editor>
      setEditorContent(html: string): Chainable<void>
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

export {}
