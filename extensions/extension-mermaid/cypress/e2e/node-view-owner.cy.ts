/// <reference types="cypress" />

// Failure mode: another `codeBlock` node view hides a diagram, or ours hides another view's code block,
// and nothing says so (#627, #628, #629).
const DOC = [
  '<pre><code class="language-mermaid">flowchart LR\n  A --> B</code></pre>',
  '<pre><code class="language-js">const a = 1</code></pre>',
  '<p>end</p>'
].join('')

const mermaidBlock = () => cy.get('.ProseMirror > *').eq(0)
const jsBlock = () => cy.get('.ProseMirror > *').eq(1)

// Sets the language of the code block at `index` and waits for ProseMirror to rebuild it.
function setLanguage(index: number, language: string): void {
  cy.getEditor().then((editor) => {
    let pos = -1
    editor.state.doc.forEach((node, offset, i) => {
      if (i === index) pos = offset
    })
    editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'language', language))
  })
}

// The playground page has no `process`, so the development check is off there. An app's dev bundle has one.
// The playground bundler already inlines `NODE_ENV` as `development`, so only the `process` object is missing.
function visitWithWarnSpy(query: string): void {
  cy.visitPlayground(query, {
    onBeforeLoad(win) {
      ;(win as unknown as { process: unknown }).process = { env: {} }
      cy.spy(win.console, 'warn').as('warn')
    }
  })
  cy.setEditorContent(DOC)
}

const ownerWarnings = () =>
  cy.get('@warn').then((spy) => {
    const calls = (spy as unknown as sinon.SinonSpy).getCalls()
    return calls.filter((c) =>
      String(c.args[0]).startsWith('[extension-mermaid] Another node view')
    ).length
  })

describe('node view owner', () => {
  it('hands a non-mermaid block to the next plugin view (#627)', () => {
    visitWithWarnSpy('?lower=plugin')
    jsBlock().should('have.attr', 'data-testid', 'lower-view')
    mermaidBlock().should('have.class', 'mermaid-diagram').find('svg').should('exist')

    setLanguage(1, 'mermaid')
    jsBlock().should('have.class', 'mermaid-diagram').find('svg').should('exist')

    setLanguage(1, 'js')
    jsBlock().should('have.attr', 'data-testid', 'lower-view')
    ownerWarnings().should('eq', 0)
  })
})
