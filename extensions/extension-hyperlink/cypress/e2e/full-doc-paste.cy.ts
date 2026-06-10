/// <reference types="cypress" />

/**
 * Full-document paste shape: select-all + paste of a mixed document
 * (paragraphs, heading, blockquote, an existing anchor, bare URLs).
 * Pins that paste linkifies bare URLs once with canonical https://
 * hrefs, never stacks marks, and block structure survives the trip.
 */

import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

const FIXTURE_HTML = [
  '<p>Intro paragraph with plain prose only.</p>',
  '<h2>Release notes</h2>',
  '<blockquote><p>Quoted wisdom citing google.com inside the quote.</p></blockquote>',
  '<p>Existing <a href="https://example.com">example link</a> mid-paragraph.</p>',
  '<p>Closing line mentioning www.github.com near the end.</p>'
].join('')

/** Text runs that must carry a hyperlink mark → the canonical stored href. */
const EXPECTED_LINKS: Record<string, string> = {
  'google.com': 'https://google.com',
  'example link': 'https://example.com',
  'www.github.com': 'https://www.github.com'
}

interface TextRun {
  text: string
  hrefs: string[]
}

const collectTextRuns = (editor: Editor): TextRun[] => {
  const runs: TextRun[] = []
  editor.state.doc.descendants((node: PMNode) => {
    if (!node.isText || !node.text) return
    runs.push({
      text: node.text,
      hrefs: node.marks
        .filter((mark) => mark.type.name === 'hyperlink')
        .map((mark) => String(mark.attrs.href))
    })
  })
  return runs
}

// Whole-doc selection on purpose — StarterKit's TrailingNode keeps an empty
// trailing paragraph, so caret flows like `focus('end')` would land there.
const selectAllAndPasteFixture = (): void => {
  cy.getEditor().then((editor) => {
    editor.chain().focus().selectAll().run()
  })
  cy.window().then((win) => {
    const dt = new win.DataTransfer()
    dt.setData('text/html', FIXTURE_HTML)
    cy.get('#editor [contenteditable="true"]').trigger('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    })
  })
}

describe('full-document paste — select-all round trip', () => {
  beforeEach(() => {
    cy.visitPlayground()
    // Stage 1 routes the fixture through the real external-paste pipeline so
    // the paste rules linkify its bare URLs (setContent leaves them plain, and
    // pasting byte-identical content gives the rules no changed range to scan).
    // Stage 2 pastes the same HTML back over the linked doc — the round trip.
    selectAllAndPasteFixture()
    cy.get('#editor a').should('have.length', 3)
    selectAllAndPasteFixture()
    cy.get('#editor a').should('have.length', 3)
  })

  it('keeps heading and blockquote structure through the round trip', () => {
    cy.get('#editor h2').should('have.length', 1).and('have.text', 'Release notes')
    cy.get('#editor blockquote').should('have.length', 1)
    cy.get('#editor blockquote a')
      .should('have.length', 1)
      .and('have.attr', 'href', 'https://google.com')
    cy.get('#editor a').should('have.length', 3)
  })

  it('carries exactly one hyperlink mark on each URL-bearing text run', () => {
    cy.getEditor().then((editor) => {
      const runs = collectTextRuns(editor)
      for (const linkText of Object.keys(EXPECTED_LINKS)) {
        const matching = runs.filter((run) => run.text === linkText)
        expect(matching, `text runs equal to "${linkText}"`).to.have.length(1)
        expect(matching[0].hrefs, `hyperlink marks on "${linkText}"`).to.have.length(1)
      }
      for (const run of runs) {
        expect(run.hrefs.length, `stacked hyperlink marks on "${run.text}"`).to.be.at.most(1)
      }
    })
  })

  it('stores canonical https:// hrefs for bare URLs and keeps the existing anchor href', () => {
    cy.getEditor().then((editor) => {
      const runs = collectTextRuns(editor)
      for (const [linkText, href] of Object.entries(EXPECTED_LINKS)) {
        const run = runs.find((candidate) => candidate.text === linkText)
        expect(run?.hrefs, `stored href for "${linkText}"`).to.deep.equal([href])
      }
    })
  })

  it('leaves the plain text around every link unmarked', () => {
    cy.getEditor().then((editor) => {
      for (const run of collectTextRuns(editor)) {
        if (run.text in EXPECTED_LINKS) continue
        expect(run.hrefs, `unexpected hyperlink on plain run "${run.text}"`).to.have.length(0)
      }
    })
  })
})

export {}
