/// <reference types="cypress" />

// Failure mode: a fence is lost or rewritten, or detection grows past the exact
// language `mermaid`. The tilde fence is a different spelling of the same node.

const GOOD = 'flowchart LR\n  A[Write] --> B[See it]'
const BROKEN = GOOD + ' -->'

// Saves the JSON, exports Markdown, clears the document, imports it again and compares.
// The clear stops a no-op import from passing on the old content.
function expectRoundTrip(): void {
  cy.getEditor().then((editor) => {
    const before = editor.getJSON()
    cy.getMarkdown().then((markdown) => {
      cy.setMarkdown('reset')
      cy.getEditor().should((cleared) => {
        expect(cleared.state.doc.firstChild?.type.name).to.equal('paragraph')
        expect(cleared.state.doc.textContent).to.equal('reset')
      })
      cy.setMarkdown(markdown)
      cy.getEditor().should((again) => {
        expect(again.getJSON()).to.deep.equal(before)
      })
    })
  })
}

function waitForSettled(): void {
  cy.get('.mermaid-diagram > [data-state]')
    .invoke('attr', 'data-state')
    .should('match', /^(ready|error|empty)$/)
}

describe('mermaid — markdown round-trip', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('keeps a ```mermaid fence as a diagram and exports the same fence', () => {
    cy.setMarkdown('```mermaid\n' + GOOD + '\n```')
    waitForSettled()
    cy.get('.mermaid-diagram__source pre').should('have.text', GOOD)
    cy.getMarkdown().should('include', '```mermaid\n' + GOOD + '\n```')
    expectRoundTrip()
  })

  it('keeps a ~~~mermaid fence as a diagram and exports it as backticks', () => {
    cy.setMarkdown('~~~mermaid\n' + GOOD + '\n~~~')
    waitForSettled()
    cy.get('.mermaid-diagram').should('exist')
    cy.getMarkdown().should('include', '```mermaid\n' + GOOD + '\n```')
    expectRoundTrip()
  })

  it('keeps a ```Mermaid fence as plain code', () => {
    cy.setMarkdown('```Mermaid\n' + GOOD + '\n```')
    cy.get('#editor pre').should('exist')
    cy.get('.mermaid-diagram').should('not.exist')
    cy.getEditor().should((editor) => {
      expect(editor.state.doc.firstChild?.attrs.language).to.equal('Mermaid')
    })
    expectRoundTrip()
  })

  it('keeps an empty mermaid fence empty', () => {
    cy.setMarkdown('```mermaid\n```')
    cy.get('.mermaid-diagram > [data-state]').should('have.attr', 'data-state', 'empty')
    expectRoundTrip()
  })

  it('keeps an invalid source byte for byte', () => {
    cy.setMarkdown('```mermaid\n' + BROKEN + '\n```')
    cy.get('.mermaid-diagram > [data-state]').should('have.attr', 'data-state', 'error')
    cy.getEditor().should((editor) => {
      expect(editor.state.doc.firstChild?.textContent).to.equal(BROKEN)
    })
    expectRoundTrip()
    cy.getEditor().should((editor) => {
      expect(editor.state.doc.firstChild?.textContent).to.equal(BROKEN)
    })
  })
})

export {}
