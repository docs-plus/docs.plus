import { section, heading, paragraph } from '../../../fixtures/docMaker'

const EDITOR = '.docy_editor > .tiptap.ProseMirror'

// A paste that never lands must not pass, so each case pastes over this doc.
const setThrowawayDoc = () => {
  cy.window().then((win) => {
    win._editor.commands.setContent('<h1>Throwaway Title</h1><p>Throwaway body</p>')
  })
}

// Meta+a/c/v never reach the clipboard under headless Electron, and Meta+a is
// select-all only on macOS. So select through the command, paste a DataTransfer.
const selectAllAndPaste = (html) => {
  cy.get(EDITOR).click()
  cy.window().then((win) => {
    win._editor.commands.selectAll()
  })
  cy.pasteWithMimeTypes({ 'text/html': html })
  cy.wait(500)
}

const copyDocHtml = () => {
  cy.window().then((win) => cy.wrap(win._editor.getHTML()).as('copiedHtml'))
}

describe('Full Document Paste (Flat Schema)', () => {
  beforeEach(() => {
    // A fresh docName per test, so no test opens on the last test's IndexedDB doc.
    cy.visitEditor({ docName: `full-doc-paste-${Date.now()}`, persist: true })
  })

  it('should rebuild the doc when its HTML is pasted over select-all', () => {
    const doc = {
      sections: [
        section('My Document Title', [
          heading(2, 'Introduction', [paragraph('Intro content here')]),
          heading(2, 'Details', [paragraph('Detail content here')]),
          heading(3, 'Sub Detail', [paragraph('Sub detail content')])
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(500)

    copyDocHtml()
    setThrowawayDoc()
    cy.get('@copiedHtml').then(selectAllAndPaste)

    // BC-1: First node must be H1
    cy.get('.docy_editor > .tiptap > h1[data-toc-id]').should('have.length', 1)
    cy.get('h1[data-toc-id]').should('contain', 'My Document Title')

    // Heading structure preserved; a paste that missed select-all would add to it
    cy.get('h2[data-toc-id]').should('have.length', 2)
    cy.get('h3[data-toc-id]').should('have.length', 1)

    // Content preserved, and the replaced doc is gone
    cy.get(EDITOR).should('contain', 'Intro content')
    cy.get(EDITOR).should('contain', 'Detail content')
    cy.get(EDITOR).should('contain', 'Sub detail content')
    cy.get(EDITOR).should('not.contain', 'Throwaway')
  })

  it('should maintain H1 as title after full-doc paste', () => {
    // Seed through the command, as createDocument does, so the setup does not hang on typing.
    cy.window().then((win) => {
      win._editor.commands.setContent('<h1>Original Title</h1><p>Some body text</p>')
    })
    cy.get('h1[data-toc-id]').should('contain', 'Original Title')

    copyDocHtml()
    setThrowawayDoc()
    cy.get('@copiedHtml').then(selectAllAndPaste)

    // BC-1: Title must remain H1
    cy.get('h1[data-toc-id]').should('have.length', 1)
    cy.get('h1[data-toc-id]').should('contain', 'Original Title')
    cy.get(EDITOR).should('contain', 'Some body text')
    cy.get(EDITOR).should('not.contain', 'Throwaway')
  })

  it('should promote a paragraph-first paste over select-all to the H1 title', () => {
    setThrowawayDoc()

    // data-pm-slice "0 0 []" marks a closed slice, as an in-editor copy does.
    // Without it ProseMirror opens the slice, and titlePasteHandler steps aside.
    selectAllAndPaste(
      '<p data-pm-slice="0 0 []">Pasted Title</p><h2>Pasted Section</h2><p>Pasted body</p>'
    )

    cy.get('.docy_editor > .tiptap > :first-child').should('match', 'h1')
    cy.get('h1[data-toc-id]').should('have.length', 1)
    cy.get('h1[data-toc-id]').should('contain', 'Pasted Title')
    cy.contains(`${EDITOR} p`, 'Pasted Title').should('not.exist')
    cy.contains('h2[data-toc-id]', 'Pasted Section').should('exist')
    cy.get(EDITOR).should('contain', 'Pasted body')
    cy.get(EDITOR).should('not.contain', 'Throwaway')
  })
})
