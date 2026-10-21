/// <reference types="cypress" />

// Failure modes: a broken diagram flashes while the writer types; the new type
// never loads; a host view loses its parts; a size limit is not enforced.
// The load-error path has no case here. See cypress/e2e/README.md.

const GOOD = 'flowchart LR\n  A[Write] --> B[See it]'
const BROKEN = GOOD + ' -->'
const SEQ = 'sequenceDiagram\n  A->>B: Hi'
const VIEW = '.mermaid-diagram > [data-state]'

function block(src: string): string {
  return '<pre><code class="language-mermaid">' + src + '</code></pre>'
}

// Changes the first mermaid block's text in place, so its node view takes the update path.
// Never use `tr.insertText('')`: it calls `deleteRange`, which can remove the whole block.
function replaceSource(text: string): void {
  cy.getEditor().then((editor) => {
    let from = -1
    let to = -1
    editor.state.doc.descendants((n, pos) => {
      if (from < 0 && n.type.name === 'codeBlock' && n.attrs.language === 'mermaid') {
        from = pos + 1
        to = pos + n.nodeSize - 1
      }
      return from < 0
    })
    editor
      .chain()
      .command(({ tr }) => {
        if (text) tr.replaceWith(from, to, editor.schema.text(text))
        else tr.delete(from, to)
        return true
      })
      .setTextSelection(from + text.length)
      .run()
  })
}

function expectState(state: string): void {
  cy.get(VIEW).should('have.attr', 'data-state', state)
}

describe('mermaid — render states', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('draws a diagram under the source', () => {
    cy.setEditorContent('<p>Intro</p>' + block(GOOD))
    expectState('ready')
    cy.get(VIEW).should('have.attr', 'contenteditable', 'false')
    cy.get(`${VIEW} svg.pele.pele-flowchart`)
      .should('have.attr', 'aria-label', 'flowchart diagram')
      .and('have.css', 'opacity', '1')
    cy.get('.mermaid-diagram__error').should('not.be.visible')
    cy.get('.mermaid-diagram__retry').should('not.be.visible')
    cy.get('.mermaid-diagram__source pre').should('be.visible').and('have.text', GOOD)
  })

  it('shows the error at once when a broken diagram loads', () => {
    cy.setEditorContent(block(BROKEN))
    expectState('error')
    cy.get('.mermaid-diagram__message')
      .invoke('text')
      .should(
        'match',
        /^(Line \d+, column \d+: this line has a mistake\.|This diagram has a mistake\.)$/
      )
    cy.get('.mermaid-diagram__detail').invoke('text').should('not.be.empty')
    cy.window().should((win) => {
      const left = Object.keys(win.sessionStorage).filter((key) =>
        key.startsWith('mermaid-diagram:rendering:')
      )
      expect(left).to.deep.equal([])
    })
    cy.get('#editor').find('[aria-live], [role=status], [role=alert], output').should('not.exist')
    cy.get('.mermaid-diagram__diagram').should('not.have.attr', 'aria-busy')
  })

  it('holds an error until 1000 ms after the last edit, keeping the last diagram undimmed', () => {
    cy.setEditorContent(block(GOOD))
    expectState('ready')
    cy.get('svg.pele').should('have.css', 'opacity', '1')
    cy.clock()
    replaceSource(BROKEN)

    const expectHeld = (): void => {
      cy.get('.mermaid-diagram div.pele-error').should('have.css', 'display', 'none')
      cy.get('svg.pele').should('have.css', 'opacity', '1')
      expectState('ready')
      cy.get('.mermaid-diagram__error').should('not.be.visible')
      cy.get('.mermaid-diagram__diagram').should('not.have.attr', 'aria-describedby')
    }

    cy.tick(300)
    expectHeld()
    cy.tick(600)
    expectHeld()
    cy.tick(99)
    expectHeld()
    cy.tick(1)
    expectState('error')
    cy.get('.mermaid-diagram__message').should('be.visible')
    cy.get('svg.pele').should('have.css', 'opacity', '0.4')
    cy.get('.mermaid-diagram__error')
      .invoke('attr', 'id')
      .then((id) => {
        cy.get('.mermaid-diagram__diagram').should('have.attr', 'aria-describedby', id)
      })
  })

  it('draws the new type after the source changes diagram type', () => {
    let root: HTMLElement
    cy.setEditorContent(block(GOOD))
    expectState('ready')
    cy.get('.mermaid-diagram').then(($root) => {
      root = $root[0]
    })

    replaceSource(SEQ)
    cy.get(`${VIEW} svg.pele.pele-sequence`).should('have.attr', 'aria-label', 'sequence diagram')
    cy.get('svg.pele-flowchart').should('not.exist')
    expectState('ready')

    replaceSource(GOOD)
    cy.get(`${VIEW} svg.pele.pele-flowchart`).should('exist')
    cy.get('svg.pele-sequence').should('not.exist')
    expectState('ready')
    cy.then(() => expect(root.isConnected).to.equal(true))
  })

  it('mounts into a custom view and leaves the rest of view.dom alone', () => {
    let root: HTMLElement
    cy.visitPlayground('?view=custom')
    cy.setEditorContent(block(GOOD))
    cy.get('.mermaid-diagram').then(($root) => {
      root = $root[0]
    })
    cy.get('[data-testid=custom-state]').should('have.text', 'ready')
    cy.get('[data-testid=custom-diagram] svg.pele').should('exist')
    cy.get('[data-testid=custom-diagram]')
      .should('have.css', 'overflow', 'hidden')
      .and(($diagram) => {
        expect(getComputedStyle($diagram[0]).contain).to.include('paint')
      })
    cy.get('.mermaid-diagram__preview').should('not.exist')

    replaceSource('')
    cy.get('[data-testid=custom-state]').should('have.text', 'empty')
    cy.get('[data-testid=custom-diagram]').should('be.empty')
    cy.get('[data-testid=custom-label]').should('have.text', 'Custom view')

    replaceSource(GOOD)
    cy.get('[data-testid=custom-state]').should('have.text', 'ready')
    cy.window().its('_customViews').should('have.length', 1)
    cy.then(() => expect(root.isConnected).to.equal(true))

    cy.setEditorContent('<p>gone</p>')
    cy.window()
      .its('_customViews')
      .should((views) => {
        expect(views).to.have.length(1)
        for (const view of views) {
          expect(view.dataset.destroyed).to.equal('true')
          expect(view.querySelector('[data-testid=custom-diagram]')?.innerHTML).to.equal('')
          expect(view.querySelector('[data-testid=custom-label]')?.textContent).to.equal(
            'Custom view'
          )
        }
      })
  })

  it('shows a limit error for a source over the default character limit', () => {
    // Follows DEFAULT_LIMITS.characters in src/constants.ts. Below Pele's own 50000.
    const big = GOOD + '\n' + '%% filler line\n'.repeat(1100)
    expect(big.length).to.be.greaterThan(10000).and.lessThan(50000)
    cy.setEditorContent(block(big))
    expectState('error')
    cy.get('.mermaid-diagram__message').should('have.text', 'This diagram is too large to draw.')
    cy.get('.mermaid-diagram__advice').should(
      'have.text',
      `It has ${big.length.toLocaleString('en-US')} characters, and the limit is 10,000. Split it into smaller diagrams.`
    )
    // Advice reads as body text, not as mono parser output.
    cy.get('.mermaid-diagram__detail').should('be.empty').and('not.be.visible')
    cy.get('.mermaid-diagram__message').then(($message) => {
      cy.get('.mermaid-diagram__advice').should(
        'have.css',
        'font-family',
        getComputedStyle($message[0]).fontFamily
      )
    })
  })
})

export {}
