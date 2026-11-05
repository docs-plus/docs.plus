/* eslint-disable no-undef */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

const moveOpts = { keepMouseDownButton: 'left', scrollBehavior: false }

const row = (text) => cy.getTocItem(text).find('> .toc__row')
const grip = (text) => row(text).find('.toc-drag-handle')

/** Presses the grip and moves past dnd-kit's 5px start distance. */
const pickUp = (text) => {
  row(text).realHover({ scrollBehavior: false })
  grip(text).then(($grip) => {
    const box = $grip[0].getBoundingClientRect()
    grip(text).realMouseDown({ position: 'center', scrollBehavior: false })
    cy.get('body').realMouseMove(box.left + box.width / 2, box.top + box.height / 2 + 12, moveOpts)
  })
  cy.get('.toc__list.is-dragging').should('exist')
}

/** Rects are read after pickup, because the ghosted rows grow. */
const hoverAbove = (text) =>
  row(text).then(($row) => {
    const box = $row[0].getBoundingClientRect()
    cy.get('body').realMouseMove(box.left + 40, box.top + 3, moveOpts)
  })

const hoverBelow = (text) =>
  row(text).then(($row) => {
    const box = $row[0].getBoundingClientRect()
    cy.get('body').realMouseMove(box.left + 40, box.bottom - 3, moveOpts)
  })

const drop = () =>
  cy.get('.toc-drop-indicator-portal').then(($line) => {
    const y = Number($line.attr('data-y'))
    cy.get('body').realMouseUp({ x: 60, y, scrollBehavior: false })
  })

const outline = () =>
  cy.window().then((win) => {
    const out = []
    win._editor.state.doc.forEach((node) => {
      if (node.type.name === 'heading') out.push(`${node.attrs.level}:${node.textContent}`)
    })
    return out
  })

describe('TOC drag by pointer', () => {
  beforeEach(() => {
    cy.visitEditor()
    cy.createDocument({
      sections: [
        section('Pointer Title', [
          heading(2, 'Alpha', [
            paragraph('alpha body'),
            heading(3, 'Alpha One', [
              paragraph('alpha one body'),
              heading(4, 'Alpha One Deep', [paragraph('deep body')])
            ])
          ]),
          heading(2, 'Bravo', [
            paragraph('bravo body'),
            heading(3, 'Bravo One', [paragraph('bravo one body')])
          ]),
          heading(2, 'Charlie', [paragraph('charlie body')])
        ])
      ]
    })
    cy.waitForToc()
  })

  it('gives the Title row no grip', () => {
    row('Pointer Title').should('exist').find('.toc-drag-handle').should('not.exist')
    grip('Bravo').should('exist')
  })

  it('derives the level from the gap and moves sub-headings with a demoted section', () => {
    pickUp('Bravo')
    hoverAbove('Alpha One')
    // DS-12: the landing parent's rail turns primary; every other rail stays stock.
    cy.getTocItem('Alpha')
      .find('> ul.toc__children')
      .should('have.class', 'is-drop-parent')
      .then(($ul) => {
        const win = $ul[0].ownerDocument.defaultView
        const rail = win.getComputedStyle($ul[0], '::before')
        const stock = win.getComputedStyle(
          $ul[0].ownerDocument.querySelector('ul.toc__children:not(.is-drop-parent)'),
          '::before'
        )
        expect(rail.opacity).to.equal('1')
        expect(stock.opacity).not.to.equal('1')
        expect(rail.backgroundColor).not.to.equal(stock.backgroundColor)
      })
    cy.get('ul.toc__children.is-drop-parent').should('have.length', 1)
    drop()

    cy.get('ul.toc__children.is-drop-parent').should('not.exist')
    outline().should('deep.equal', [
      '1:Pointer Title',
      '2:Alpha',
      '3:Bravo',
      '4:Bravo One',
      '3:Alpha One',
      '4:Alpha One Deep',
      '2:Charlie'
    ])
  })

  it('moves sub-headings with a promoted section', () => {
    pickUp('Alpha One')
    hoverAbove('Bravo')
    // A root-level child of the Title lands under the Title's own rail.
    cy.getTocItem('Pointer Title').find('> ul.toc__children').should('have.class', 'is-drop-parent')
    drop()

    outline().should('deep.equal', [
      '1:Pointer Title',
      '2:Alpha',
      '2:Alpha One',
      '3:Alpha One Deep',
      '2:Bravo',
      '3:Bravo One',
      '2:Charlie'
    ])
  })

  it('keeps the caret in the moved text', () => {
    cy.window().then((win) => {
      const editor = win._editor
      let caret = null
      editor.state.doc.descendants((node, pos) => {
        if (caret === null && node.isText && node.text === 'bravo body') caret = pos + 3
      })
      editor.commands.setTextSelection(caret)
    })

    pickUp('Bravo')
    hoverAbove('Alpha')
    drop()

    outline().should('deep.equal', [
      '1:Pointer Title',
      '2:Bravo',
      '3:Bravo One',
      '2:Alpha',
      '3:Alpha One',
      '4:Alpha One Deep',
      '2:Charlie'
    ])
    cy.window().then((win) => {
      const { $from } = win._editor.state.selection
      expect($from.parent.textContent).to.equal('bravo body')
      expect($from.parentOffset).to.equal(3)
    })
  })

  it('lands a drop below a folded row after its whole section', () => {
    row('Alpha').find('button.toc__fold-btn').click({ force: true })
    row('Alpha One').should('not.be.visible')

    pickUp('Charlie')
    hoverBelow('Alpha')
    drop()

    outline().should('deep.equal', [
      '1:Pointer Title',
      '2:Alpha',
      '3:Alpha One',
      '4:Alpha One Deep',
      '2:Charlie',
      '2:Bravo',
      '3:Bravo One'
    ])
  })

  it('shows no grip on a locked pad', () => {
    grip('Bravo').should('exist')
    cy.window().then((win) => {
      win._store.getState().setWorkspaceSetting('authorizedScope', 'readonly')
    })
    cy.get('.toc__list .toc-drag-handle').should('not.exist')
  })

  it('refuses a drop above the Title', () => {
    pickUp('Charlie')
    hoverAbove('Pointer Title')
    cy.get('.toc-drop-indicator-portal').should('not.exist')
    cy.get('body').should('have.css', 'cursor', 'no-drop')
    cy.get('body').realMouseUp({ x: 60, y: 5, scrollBehavior: false })
    cy.get('body').should('not.have.css', 'cursor', 'no-drop')
    outline().its(1).should('equal', '2:Alpha')
  })
})
