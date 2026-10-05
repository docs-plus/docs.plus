/// <reference types="cypress" />

import { heading, paragraph, section } from '../../../fixtures/docMaker'

type PadEditor = {
  state: {
    selection: { from: number; to: number }
    doc: {
      textBetween(from: number, to: number): string
      firstChild: { nodeSize: number } | null
      descendants(fn: (node: { isText: boolean; text?: string }, pos: number) => void): void
    }
  }
  commands: { setTextSelection(pos: number): boolean; focus(): boolean }
  setEditable(editable: boolean): void
  getJSON(): unknown
}

// A fresh room per test, because the shared persist room keeps old content.
let DOC_NAME = 'caret-find'
const foldKey = () => `editor-folds-${DOC_NAME}`
const MOD = Cypress.platform === 'darwin' ? 'Meta' : 'Control'
const EDITOR = '.docy_editor > .tiptap.ProseMirror'
const BAR = '[data-testid="caret-find-bar"]'
const INPUT = '[data-testid="caret-find-input"]'
const COUNT = '[data-testid="caret-find-count"]'
// The spoken count, which follows the visible count after a short pause.
const STATUS = '[data-testid="caret-find-status"]'

const withEditor = (fn: (editor: PadEditor) => void) =>
  cy.window().then((win) => fn((win as unknown as { _editor: PadEditor })._editor))

// Sorted, because a rebuilt Set may reorder the stored ids.
const parseFolds = (raw: string | null) => (raw ? (JSON.parse(raw) as string[]).slice().sort() : [])

// A query chain, so each `.should` callback retries until storage catches up.
const storedFolds = () => cy.window().its('localStorage').invoke('getItem', foldKey())

const openWithShortcut = () => {
  cy.get(EDITOR).click()
  withEditor((editor) => editor.commands.setTextSelection(1))
  cy.realPress([MOD, 'f'])
  cy.get(INPUT).should('have.focus')
}

describe('Caret find (desktop)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800)
    DOC_NAME = `caret-find-${Date.now()}`
    cy.visitEditor({ docName: DOC_NAME, persist: true })
    cy.createDocument({
      sections: [
        section('Apple Title', [
          heading(2, 'Alpha', [
            paragraph('first APPLE body'),
            heading(3, 'Deep', [paragraph('deep apple here')])
          ]),
          // The child heading gives Beta a TOC fold button.
          heading(2, 'Beta', [
            paragraph('beta apple text'),
            heading(3, 'Beta Child', [paragraph('beta child body')])
          ])
        ])
      ]
    })
    cy.waitForToc()
    withEditor((editor) => editor.commands.setTextSelection(1))
  })

  it('finds literal case-insensitive hits with decorations and steps the caret', () => {
    cy.location('href').then((href) => {
      openWithShortcut()
      cy.get('#filterSearchBox').should('not.exist') // Find is not the Filter panel

      cy.get(INPUT).type('ApPlE')
      cy.get(`${EDITOR} .caret-find-hit`).should('have.length', 4)
      cy.get(`${EDITOR} .heading-filter-highlight`).should('not.exist')
      cy.get(COUNT).should('have.text', '1 of 4')
      cy.get(STATUS).should('have.text', '1 of 4').and('have.attr', 'role', 'status')
      cy.get(STATUS).closest('.ProseMirror').should('not.exist')

      cy.get(INPUT).type('{enter}')
      cy.get(COUNT).should('have.text', '2 of 4')
      withEditor((editor) => {
        const { from } = editor.state.selection
        expect(editor.state.doc.textBetween(from, from + 5).toLowerCase()).to.eq('apple')
      })

      cy.get(INPUT).type('{shift}{enter}')
      cy.get(COUNT).should('have.text', '1 of 4')
      withEditor((editor) => {
        expect(editor.state.selection.from).to.be.lessThan(
          editor.state.doc.firstChild?.nodeSize ?? 0
        ) // the hit in Title
      })
      cy.get(INPUT).type('{shift}{enter}')
      cy.get(COUNT).should('have.text', '4 of 4')

      withEditor((editor) => {
        const json = JSON.stringify(editor.getJSON())
        expect(json).not.to.include('"highlight"')
        expect(json).not.to.include('caret-find')
      })

      cy.get(INPUT).type('{esc}')
      cy.get(BAR).should('not.exist')
      cy.get(`${EDITOR} .caret-find-hit`).should('not.exist')
      cy.location('href').should('eq', href)
    })
  })

  it('takes over Mod-f and prevents the browser find', () => {
    cy.window().then((win) => {
      const seen: boolean[] = []
      win.addEventListener('keydown', (event) => {
        if (event.code === 'KeyF') seen.push(event.defaultPrevented)
      })
      cy.wrap(seen).as('findKeys')
    })

    cy.get('[data-testid="toolbar-find"]').should('not.exist')
    cy.get(EDITOR).click()
    cy.realPress([MOD, 'f'])
    cy.get(BAR).should('be.visible')
    cy.get(INPUT).should('have.focus')
    cy.get('@findKeys').should('deep.equal', [true])
  })

  it('Escape from Next closes the bar and selects the match', () => {
    openWithShortcut()
    cy.get(INPUT).type('beta apple')
    cy.get(COUNT).should('have.text', '1 of 1')
    // Typing never moves the caret; only a step or a close does.
    withEditor((editor) => expect(editor.state.selection.from).to.eq(1))
    cy.get('[aria-label="Next match"]').focus().should('have.focus')
    cy.realPress('Escape')
    cy.get(BAR).should('not.exist')
    cy.get(EDITOR).should('have.focus')
    withEditor((editor) => {
      const { from, to } = editor.state.selection
      expect(editor.state.doc.textBetween(from, to).toLowerCase()).to.eq('beta apple')
    })
  })

  it('Mod-g from the editor steps, and Escape in the editor closes the bar', () => {
    openWithShortcut()
    cy.get(INPUT).type('apple')
    cy.get(COUNT).should('have.text', '1 of 4')
    withEditor((editor) => editor.commands.focus())
    cy.get(EDITOR).should('have.focus')
    cy.realPress([MOD, 'g'])
    cy.get(COUNT).should('have.text', '2 of 4')

    // A caret moved inside the third match makes it current, so the next step is the fourth.
    withEditor((editor) => {
      let pos = -1
      editor.state.doc.descendants((node, at) => {
        if (node.isText && node.text?.startsWith('deep apple')) pos = at + 'deep ap'.length
      })
      editor.commands.setTextSelection(pos)
    })
    cy.get(COUNT).should('have.text', '3 of 4')
    cy.realPress([MOD, 'g'])
    cy.get(COUNT).should('have.text', '4 of 4')

    cy.realPress('Escape')
    cy.get(BAR).should('not.exist')
  })

  it('reopen announces the first count', () => {
    openWithShortcut()
    cy.get(INPUT).type('apple')
    cy.get(STATUS).should('have.text', '1 of 4')
    cy.get(INPUT).type('{esc}')
    cy.get(BAR).should('not.exist')

    // A held clock keeps the spoken count empty until the pause ends, on any runner speed.
    cy.clock()
    cy.realPress([MOD, 'f'])
    cy.get(INPUT).should('have.focus')
    cy.get(STATUS).should('have.text', '')
    cy.tick(500)
    cy.get(STATUS).should('have.text', '1 of 4')
  })

  it('unfolds a folded hit, restores the exact folds on Esc, and keeps fold saving alive', () => {
    cy.getTocItem('Alpha').find('button.toc__fold-btn').click({ force: true })
    cy.get(`${EDITOR} .heading-fold-hidden`).should('exist')

    storedFolds()
      .should((raw) => expect(parseFolds(raw)).to.have.length(1))
      .then((initial) => {
        const before = parseFolds(initial)

        openWithShortcut()
        cy.get(INPUT).type('deep apple')
        cy.get(COUNT).should('have.text', '1 of 1')
        cy.contains(`${EDITOR} p`, 'deep apple here').should('be.visible')
        cy.get(`${EDITOR} .heading-fold-hidden`).should('not.exist')
        // The temporary unfold is never saved.
        storedFolds().should((raw) => expect(parseFolds(raw)).to.deep.equal(before))

        cy.get(INPUT).type('{esc}')
        cy.get(`${EDITOR} .heading-fold-hidden`).should('exist')
        cy.contains(`${EDITOR} p`, 'deep apple here').should('not.be.visible')
        storedFolds().should((raw) => expect(parseFolds(raw)).to.deep.equal(before))

        // A user fold after Find must still reach storage.
        cy.getTocItem('Beta').find('button.toc__fold-btn').click({ force: true })
        storedFolds().should((raw) => expect(parseFolds(raw)).to.have.length(2))
      })
  })

  it('paints 200 hits but counts and steps past them', () => {
    cy.createDocument({
      sections: [section('Cap Doc', [paragraph('ab '.repeat(250))])]
    })

    openWithShortcut()
    cy.get(INPUT).type('ab')
    cy.get(COUNT).should('have.text', '1 of 250')
    cy.get(`${EDITOR} .caret-find-hit`).should('have.length', 200)
    cy.get(INPUT).type('{shift}{enter}')
    cy.get(COUNT).should('have.text', '250 of 250')
    cy.get(`${EDITOR} .caret-find-current`).should('exist')
  })

  it('still finds when the pad is read-only', () => {
    withEditor((editor) => editor.setEditable(false))

    openWithShortcut()
    cy.get(INPUT).type('apple')
    cy.get(COUNT).should('have.text', '1 of 4')
    cy.get(INPUT).type('{enter}')
    cy.get(COUNT).should('have.text', '2 of 4')
  })

  it('no longer labels the Filter field as Find in document', () => {
    cy.get('[aria-label="Filter document"]').first().click({ force: true })
    cy.get('#filterSearchBox')
      .should('not.have.attr', 'aria-label', 'Find in document')
      .and('have.attr', 'placeholder')
      .and('not.include', 'Find in document')
  })
})
