/// <reference types="cypress" />

/**
 * Support file for the extension-hyperlink clean-room E2E suite.
 *
 * Intentionally a single file: the custom-command surface is tiny and split
 * across multiple modules caused Cypress 15's JIT loader to silently skip
 * extensionless imports. Keeping it flat avoids that footgun.
 */

import type * as HyperlinkModule from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

import 'cypress-real-events'

interface VisitPlaygroundOptions {
  popover?: 'custom'
}

/**
 * Shape of the globals the playground (`test/playground/main.ts`) exposes.
 * Declared here so spec files get real types — the playground's own
 * `declare global` augmentation lives in a separate TypeScript project
 * (Bun bundler) and isn't visible to Cypress' compiler. Kept in sync by
 * hand; the set is tiny and stable.
 */
interface PlaygroundByoState {
  createCalls: HyperlinkModule.CreateHyperlinkOptions[]
  previewCalls: HyperlinkModule.PreviewHyperlinkOptions[]
  configuredValidate: (url: string) => boolean
}

declare global {
  interface Window {
    _editor: Editor
    _hyperlink: typeof HyperlinkModule
    _byo?: PlaygroundByoState
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      visitPlayground(options?: VisitPlaygroundOptions): Chainable<void>
      getEditor(): Chainable<Editor>
      selectText(text: string): Chainable<void>
      setEditorContent(html: string): Chainable<void>
      editorFirstLinkHref(): Chainable<string>
    }
  }
}

Cypress.Commands.add('visitPlayground', (options: VisitPlaygroundOptions = {}) => {
  cy.visit(options.popover === 'custom' ? '/?popover=custom' : '/')
  cy.window({ timeout: 10000 }).should('have.property', '_editor')
  cy.window().its('_editor').should('be.an', 'object')
  if (options.popover === 'custom') {
    cy.window().its('_byo').should('be.an', 'object')
  }
})

Cypress.Commands.add('getEditor', () => {
  return cy.window().its('_editor')
})

Cypress.Commands.add('selectText', (text: string) => {
  cy.getEditor().then((editor) => {
    let from: number | undefined
    let to: number | undefined
    editor.state.doc.descendants((node: PMNode, pos: number) => {
      if (from !== undefined) return
      if (node.isText && node.text && node.text.includes(text)) {
        const offset = node.text.indexOf(text)
        from = pos + offset
        to = from + text.length
      }
    })
    if (from === undefined || to === undefined) {
      throw new Error(`selectText: could not find "${text}" in the document`)
    }
    editor.chain().focus().setTextSelection({ from, to }).run()
  })
})

Cypress.Commands.add('setEditorContent', (html: string) => {
  cy.getEditor().then((editor) => {
    editor.commands.setContent(html)
  })
})

Cypress.Commands.add('editorFirstLinkHref', () => {
  return cy
    .get('#editor a', { timeout: 4000 })
    .first()
    .should('have.attr', 'href')
    .then((href) => href.toString())
})

export {}
