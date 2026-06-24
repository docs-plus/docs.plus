import { registerPlaygroundMarkdownCommands } from '@docs.plus/playground/cypress/markdownCommands'

type EditorWindow = {
  _editor?: {
    state: { doc: { descendants: (fn: (node: { type: { name: string } }) => void) => void } }
  }
}

registerPlaygroundMarkdownCommands({ ensureTitleDocumentH1: true })

Cypress.Commands.add('nodeCount', (typeName: string) => {
  return cy.window().then((win) => {
    const editor = (win as unknown as EditorWindow)._editor
    if (!editor) throw new Error('_editor missing — visitEditor must run first')
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === typeName) count++
    })
    return count
  })
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      nodeCount(typeName: string): Chainable<number>
    }
  }
}

export {}
