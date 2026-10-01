/// <reference types="cypress" />

// Issue #251. realType, because the Suggestion plugin reads the real beforeinput path.

type PadNode = {
  type: { name: string }
  attrs: Record<string, unknown>
  isTextblock: boolean
  content: { size: number }
  textContent: string
}

type PadEditor = {
  state: {
    selection: { from: number; $from: { parent: PadNode } }
    doc: {
      descendants(fn: (node: PadNode, pos: number) => boolean | void): void
      childCount: number
    }
  }
  commands: {
    setContent(html: string): boolean
    focus(): boolean
    setTextSelection(pos: number): boolean
  }
}

type PlaygroundWindow = {
  _editor: PadEditor
  _store: {
    getState(): { setWorkspaceSettings(partial: Record<string, unknown>): void }
  }
}

const EDITOR = '.docy_editor > .tiptap.ProseMirror'
const MENU = '[data-testid="slash-menu"]'
const OPTION = '[data-testid="slash-menu-option"]'

const withWindow = (fn: (win: PlaygroundWindow) => void) =>
  cy.window().then((win) => fn(win as unknown as PlaygroundWindow))

const withEditor = (fn: (editor: PadEditor) => void) => withWindow((win) => fn(win._editor))

/** Replace the pad and put the caret in the first empty block of that type after Title. */
const startIn = (html: string, blockType = 'paragraph') => {
  withEditor((editor) => {
    editor.commands.setContent(html)
    let target = -1
    editor.state.doc.descendants((node, pos) => {
      if (target >= 0) return false
      if (pos > 0 && node.isTextblock && node.type.name === blockType && !node.content.size) {
        target = pos + 1
      }
    })
    expect(target, `empty ${blockType}`).to.be.greaterThan(0)
    editor.commands.focus()
    editor.commands.setTextSelection(target)
  })
  cy.get(EDITOR).focus()
}

const caretBlock = (fn: (block: PadNode) => void) =>
  withEditor((editor) => fn(editor.state.selection.$from.parent))

describe('Slash menu (desktop)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800)
    cy.visitEditor({ docName: `slash-menu-${Date.now()}`, persist: true })
  })

  it('opens on an empty line and keeps focus in the editor', () => {
    startIn('<h1>Doc</h1><p></p>')
    cy.get(EDITOR).realType('/')
    cy.get('[data-testid="slash-menu-popup"]').should('be.visible')
    cy.get(OPTION)
      .first()
      .should('have.text', 'Heading 1')
      .and('have.attr', 'aria-selected', 'true')
    cy.get(EDITOR)
      .should('have.focus')
      .and('have.attr', 'aria-activedescendant', 'slash-menu-option-0')
      .and('have.attr', 'aria-controls', 'slash-menu-listbox')
  })

  it('stays text after other text, in a path, and in a URL', () => {
    startIn('<h1>Doc</h1><p></p>')
    cy.get(EDITOR).realType('a/b ')
    cy.get(MENU).should('not.exist')
    cy.get(EDITOR).realType('https://docs.plus/x')
    cy.get(MENU).should('not.exist')
    caretBlock((block) => expect(block.textContent).to.eq('a/b https://docs.plus/x'))
  })

  it('never opens on Title', () => {
    startIn('<h1>Doc</h1><p></p>')
    withEditor((editor) => {
      editor.commands.setContent('<h1></h1><p>body</p>')
      editor.commands.setTextSelection(1)
    })
    cy.get(EDITOR).focus()
    cy.get(EDITOR).realType('/')
    cy.get(MENU).should('not.exist')
  })

  it('filters with /h3, and Enter makes a Heading 3 with the caret inside', () => {
    startIn('<h1>Doc</h1><p></p>')
    cy.get(EDITOR).realType('/h3')
    cy.get(OPTION).should('have.length', 1).first().should('have.text', 'Heading 3')
    cy.realPress('Enter')
    cy.get(MENU).should('not.exist')
    cy.get(EDITOR).realType('Deep')
    caretBlock((block) => {
      expect(block.type.name).to.eq('heading')
      expect(block.attrs.level).to.eq(3)
      expect(block.textContent).to.eq('Deep')
    })
  })

  it('Escape closes and leaves the typed text', () => {
    startIn('<h1>Doc</h1><p></p>')
    cy.get(EDITOR).realType('/h3')
    cy.get(MENU).should('be.visible')
    cy.realPress('Escape')
    cy.get(MENU).should('not.exist')
    caretBlock((block) => {
      expect(block.type.name).to.eq('paragraph')
      expect(block.textContent).to.eq('/h3')
    })
  })

  it('arrow keys and Enter drive the list, not the caret, inside a heading', () => {
    startIn('<h1>Doc</h1><h2></h2><p>after</p>', 'heading')
    withEditor((editor) => cy.wrap(editor.state.doc.childCount).as('blocks'))
    cy.get(EDITOR).realType('/')
    cy.realPress('ArrowDown')
    cy.realPress('ArrowDown')
    cy.get(`${OPTION}[aria-selected="true"]`).should('have.text', 'Heading 3')
    cy.get(EDITOR).should('have.attr', 'aria-activedescendant', 'slash-menu-option-2')
    cy.realPress('Enter')
    caretBlock((block) => {
      expect(block.attrs.level).to.eq(3)
      expect(block.textContent).to.eq('')
    })
    cy.get('@blocks').then((blocks) =>
      withEditor((editor) => expect(editor.state.doc.childCount).to.eq(blocks))
    )
  })

  it('Heading 1 starts a new Section in the TOC', () => {
    startIn('<h1>Doc</h1><p></p>')
    cy.get(EDITOR).realType('/heading1')
    cy.get(OPTION).should('have.length', 1)
    cy.realPress('Enter')
    cy.get(EDITOR).realType('Fresh Section')
    cy.get(`${EDITOR} > h1`).contains('Fresh Section')
    cy.get('.toc__list').should('contain', 'Fresh Section')
  })

  it('Picture opens the toolbar Insert media panel', () => {
    startIn('<h1>Doc</h1><p></p>')
    cy.get(EDITOR).realType('/picture')
    cy.get(OPTION).should('have.length', 1).first().should('have.text', 'Picture')
    cy.realPress('Enter')
    cy.get(MENU).should('not.exist')
    cy.get(EDITOR).should('not.contain', '/picture')
    cy.get('[role="dialog"] [role="tabpanel"]').should('be.visible')
    caretBlock((block) => expect(block.textContent).to.eq(''))
  })

  it('Link to a section opens hyperlink create with heading suggestions', () => {
    startIn('<h1>Doc</h1><h2>Target Heading</h2><p></p>')
    cy.get(EDITOR).realType('/link')
    cy.get(OPTION).first().should('have.text', 'Link to a section')
    cy.realPress('Enter')
    cy.get('[data-testid="hyperlink-create-popover"]').should('be.visible')
    cy.get('[data-testid="hyperlink-suggestions-expand"]').click()
    cy.get('[data-testid="hyperlink-suggestion-row"][data-suggestion-kind="heading"]').should(
      'contain',
      'Target Heading'
    )
  })

  it('does not open under the Editing lock', () => {
    startIn('<h1>Doc</h1><p></p>')
    withWindow((win) => win._store.getState().setWorkspaceSettings({ authorizedScope: 'readonly' }))
    cy.get(EDITOR).realType('/')
    cy.get(MENU).should('not.exist')
    caretBlock((block) => expect(block.textContent).to.eq('/'))
  })
})
