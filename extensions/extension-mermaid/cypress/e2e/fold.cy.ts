/// <reference types="cypress" />

import { GapCursor } from '@tiptap/pm/gapcursor'

// Failure mode: hidden source holds the caret, or a fold choice is lost or leaks.
// A caret inside a folded source opens it at build time, so the specs that need a folded
// block keep the caret out of it. The head actions take no clicks until hover or focus, and Cypress cannot hover,
// so each click is preceded by `.focus()`.

const GOOD = 'flowchart LR\n  A[Write] --> B[See it]'
const VIEW = '.mermaid-diagram > [data-state]'
const HELP_URL = 'https://mermaid.js.org/intro/syntax-reference.html'

function block(src: string): string {
  return '<pre><code class="language-mermaid">' + src + '</code></pre>'
}

// setContent leaves the caret at the document end. The trailing paragraph keeps it out of
// the source, so the block can stay folded.
const DOC = block(GOOD) + '<p>After</p>'

describe('mermaid — fold', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  it('folds the source and remembers it after a reload', () => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
    cy.get('.mermaid-diagram__fold').focus().click()
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    cy.get('.mermaid-diagram__source pre').should('not.be.visible')
    cy.get('.mermaid-diagram__summary').should('have.text', 'Mermaid source · 2 lines hidden')

    cy.reload()
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
    cy.setEditorContent(DOC)
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    cy.get('.mermaid-diagram__source pre').should('not.be.visible')
  })

  it('opens a folded block when the caret enters it, without remembering', () => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
    cy.get('.mermaid-diagram__fold').focus().click()
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')

    cy.getEditor().then((editor) => {
      let inside = -1
      editor.state.doc.descendants((node, pos) => {
        if (inside < 0 && node.type.name === 'codeBlock') inside = pos + 1
        return inside < 0
      })
      editor.chain().setTextSelection(inside).run()
    })
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'open')
    cy.get('.mermaid-diagram__source pre').should('be.visible')

    cy.reload()
    cy.window({ timeout: 10000 }).should('have.property', '_editor')
    cy.setEditorContent(DOC)
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
  })

  // One per-editor lookup finds the block that holds the caret. A wrong lookup opens a block
  // the caret never entered. Distinct sources keep the two remembered choices apart.
  it('opens only the folded block that the caret enters', () => {
    cy.visitPlayground()
    cy.setEditorContent(block(GOOD) + block('flowchart TD\n  C --> D') + '<p>After</p>')
    cy.get('.mermaid-diagram__fold').eq(0).focus().click()
    cy.get('.mermaid-diagram__fold').eq(1).focus().click()
    cy.get('.mermaid-diagram[data-source="folded"]').should('have.length', 2)

    cy.getEditor().then((editor) => {
      let inside = -1
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'codeBlock') inside = pos + 1
        return true
      })
      editor.chain().setTextSelection(inside).run()
    })
    cy.get('.mermaid-diagram').eq(1).should('have.attr', 'data-source', 'open')
    cy.get('.mermaid-diagram').eq(0).should('have.attr', 'data-source', 'folded')
  })

  // A real key press proves the caret does not hide behind `visibility: hidden`. That flips
  // 200 ms after the fold, so wait for it. Gate on focus first: `realPress` is a parent command.
  it('opens a folded block on a real ArrowDown and ArrowUp press', () => {
    cy.visitPlayground()
    cy.setEditorContent('<p>Before</p>' + DOC)
    cy.get('.mermaid-diagram__fold').focus().click()
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    cy.get('.mermaid-diagram__source pre').should('not.be.visible')

    cy.getEditor().then((editor) => {
      // End of the "Before" paragraph, the last caret spot above the block.
      editor
        .chain()
        .focus()
        .setTextSelection(editor.state.doc.firstChild!.nodeSize - 1)
        .run()
    })
    cy.get('.ProseMirror').should('have.focus')
    cy.realPress('ArrowDown')
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'open')
    cy.getEditor().then((editor) => {
      expect(editor.state.selection.$from.parent.type.name).to.equal('codeBlock')
    })

    cy.get('.mermaid-diagram__fold').focus().click()
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    cy.get('.mermaid-diagram__source pre').should('not.be.visible')
    cy.getEditor().then((editor) => {
      editor
        .chain()
        .focus()
        .setTextSelection(editor.state.doc.content.size - 1)
        .run()
    })
    cy.get('.ProseMirror').should('have.focus')
    cy.realPress('ArrowUp')
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'open')
    cy.getEditor().then((editor) => {
      expect(editor.state.selection.$from.parent.type.name).to.equal('codeBlock')
    })
  })

  // A gap cursor sits at depth 0 with no textblock. An unguarded endOfTextblock throws on it,
  // and Cypress fails the spec on an uncaught error from the keydown handler.
  it('ignores an arrow key while a gap cursor is selected', () => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
    cy.getEditor().then((editor) => {
      const { state } = editor
      editor.view.dispatch(state.tr.setSelection(new GapCursor(state.doc.resolve(0))))
    })
    cy.get('.ProseMirror').trigger('keydown', { key: 'ArrowUp' })
    cy.get('.ProseMirror').trigger('keydown', { key: 'ArrowDown' })
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'open')
  })

  it('starts folded in a read-only editor', () => {
    cy.visitPlayground('?readonly')
    cy.setEditorContent(block(GOOD))
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    // A button, so a link extension's capture listeners never see an `<a>` to take.
    cy.window().then((win) => cy.stub(win, 'open').as('open'))
    cy.get('.mermaid-diagram__help').should('match', 'button').focus().click()
    cy.get('@open').should('have.been.calledWith', HELP_URL, '_blank', 'noopener,noreferrer')
  })

  it('keeps the faded label from taking clicks meant for the actions', () => {
    cy.visitPlayground()
    cy.setEditorContent(DOC)
    cy.get('.mermaid-diagram__label').should('have.css', 'pointer-events', 'none')
  })

  it('shows no head with fold, copy and helpLink turned off', () => {
    cy.visitPlayground('?bare')
    cy.setEditorContent(block(GOOD))
    cy.get(VIEW).should('exist')
    cy.get('.mermaid-diagram__head').should('not.exist')
  })

  it('copies the whole source and confirms it', () => {
    cy.visitPlayground()
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('writeText').resolves()
    })
    cy.setEditorContent(block(GOOD))
    cy.get(VIEW).should('have.attr', 'data-state', 'ready')
    cy.clock()
    cy.get('.mermaid-diagram__copy').focus().click()
    cy.get('@writeText').should('have.been.calledOnceWithExactly', GOOD)
    cy.get('.mermaid-diagram__copy').should('have.attr', 'aria-label', 'Copied')
    cy.tick(2200)
    cy.get('.mermaid-diagram__copy').should('have.attr', 'aria-label', 'Copy Mermaid source')
  })
})

export {}
