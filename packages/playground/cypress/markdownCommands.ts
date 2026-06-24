/** Shared Cypress markdown helpers for extension clean-room playgrounds. */

export type PlaygroundMarkdownWindow = {
  _editor?: { commands: { setContent: (json: unknown) => void } }
  _getMarkdown?: () => string
  _parseMarkdown?: (markdown: string) => Record<string, unknown> | undefined
}

export type RegisterMarkdownCommandsOptions = {
  /** Webapp TitleDocument requires a top-level H1; prepend one when markdown omits it. */
  ensureTitleDocumentH1?: boolean
}

const withTitleDocumentH1 = (json: Record<string, unknown>): Record<string, unknown> => {
  const blocks = (json.content as Record<string, unknown>[] | undefined) ?? []
  const first = blocks[0]
  const hasTitle =
    first?.type === 'heading' && (first.attrs as { level?: number } | undefined)?.level === 1

  if (hasTitle) return json

  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Test' }] },
      ...blocks
    ]
  }
}

export function registerPlaygroundMarkdownCommands(
  options: RegisterMarkdownCommandsOptions = {}
): void {
  const { ensureTitleDocumentH1 = false } = options

  Cypress.Commands.add('setMarkdown', (markdown: string) => {
    cy.window().then((win) => {
      const w = win as PlaygroundMarkdownWindow
      const json = w._parseMarkdown?.(markdown)
      expect(json, 'parseMarkdown').to.be.an('object')
      if (!w._editor) throw new Error('_editor missing — visit playground first')
      w._editor.commands.setContent(ensureTitleDocumentH1 ? withTitleDocumentH1(json!) : json!)
    })
  })

  Cypress.Commands.add('getMarkdown', () => {
    return cy.window().then((win) => {
      const md = (win as PlaygroundMarkdownWindow)._getMarkdown?.()
      expect(md, 'getMarkdown').to.be.a('string')
      return md as string
    })
  })
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      setMarkdown(markdown: string): Chainable<void>
      getMarkdown(): Chainable<string>
    }
  }
}

export {}
