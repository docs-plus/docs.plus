/// <reference types="cypress" />

// Reworked arrow exit: at the document end, ArrowRight clears the stored code
// mark so the next char is plain — without inserting a space (the old behavior,
// and core's `exitable` handler, would mutate the document).

describe('inline code — arrow exit', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>code</p>')
    cy.selectText('code')
    cy.toggleInlineCode()
    cy.setCaretAfter('code') // caret at the right edge = document end
  })

  it('ArrowRight at the document end exits code mode without inserting a space', () => {
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.pressKey('ArrowRight')
    cy.getEditor().should((e) => {
      expect(e.isActive('inlineCode')).to.equal(false) // stored mark cleared
      expect(e.getText()).to.equal('code') // no space inserted
    })
  })

  it('after the ArrowRight exit, the next typed char is plain', () => {
    cy.pressKey('ArrowRight')
    cy.typeInEditor('X')
    cy.get('#editor code').should('have.text', 'code') // X is outside the code mark
    cy.getEditor().should((e) => expect(e.getText()).to.equal('codeX'))
  })
})

// A nested last textblock ends before doc.content.size - 1, so the old guard
// never fired there. Selection.atEnd covers it. `?trailingNode=off` keeps
// StarterKit from appending an escape paragraph after the nested block.
describe('inline code — arrow exit from a nested last textblock', () => {
  const enterCodeModeAtEndOf = (html: string) => {
    cy.setEditorContent(html)
    cy.selectText('code')
    cy.toggleInlineCode()
    cy.setCaretAfter('code') // right edge of the mark = absolute document end
  }

  beforeEach(() => {
    cy.visitPlayground('?trailingNode=off')
  })

  it('exits code mode at the end of a blockquote paragraph', () => {
    enterCodeModeAtEndOf('<blockquote><p>code</p></blockquote>')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.pressKey('ArrowRight')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(false))
    cy.typeInEditor('X')
    cy.get('#editor code').should('have.text', 'code') // X lands outside the mark
    cy.get('#editor blockquote p').should('have.text', 'codeX')
  })

  it('exits code mode at the end of a list item', () => {
    enterCodeModeAtEndOf('<ul><li><p>code</p></li></ul>')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.pressKey('ArrowRight')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(false))
    cy.typeInEditor('X')
    cy.get('#editor li code').should('have.text', 'code')
    cy.get('#editor li p').should('have.text', 'codeX')
  })
})

// A just-toggled empty code mode lives only in storedMarks — $from.marks() is
// empty — so the exit handler must consult storedMarks too.
describe('inline code — arrow exit clears a pending stored mark', () => {
  it('ArrowRight at the doc end drops a toggled-on stored mark before any typing', () => {
    cy.visitPlayground()
    cy.setEditorContent('<p></p>')
    cy.getEditor().then((e) => e.chain().focus('end').toggleInlineCode().run())
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(true))
    cy.pressKey('ArrowRight')
    cy.getEditor().should((e) => expect(e.isActive('inlineCode')).to.equal(false))
    cy.typeInEditor('x')
    cy.get('#editor code').should('not.exist') // typed char is plain
    cy.getEditor().should((e) => expect(e.getText()).to.equal('x'))
  })
})

export {}
