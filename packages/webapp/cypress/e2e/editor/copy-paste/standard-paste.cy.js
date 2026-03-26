import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Standard Paste (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'standard-paste-test', persist: true })
  })

  it('should preserve heading structure on copy-paste', () => {
    const doc = {
      sections: [
        section('Paste Test', [
          heading(2, 'Sub Heading', [paragraph('Some content')]),
          paragraph('A paragraph')
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(300)

    // Verify initial structure
    cy.get('h1[data-toc-id]').should('contain', 'Paste Test')
    cy.get('h2[data-toc-id]').should('contain', 'Sub Heading')

    // Select all and copy
    cy.get('.docy_editor > .tiptap.ProseMirror').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'a'])
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'c'])
    cy.wait(200)

    // Clear and paste
    cy.clearEditor()
    cy.wait(200)
    cy.get('.docy_editor > .tiptap.ProseMirror').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Meta', 'v'])
    cy.wait(500)

    // Verify structure preserved
    cy.get('h1[data-toc-id]').should('exist')
    cy.get('h2[data-toc-id]').should('contain', 'Sub Heading')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'Some content')
  })

  it('should handle paste of plain text into heading', () => {
    cy.clearEditor()
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Test Title{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('## My Heading{enter}')

    // Type some plain text
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Plain paragraph text')

    // Verify the heading and paragraph are separate
    cy.get('h2[data-toc-id]').should('contain', 'My Heading')
    cy.get('.docy_editor .tiptap.ProseMirror p').should('contain', 'Plain paragraph text')
  })
})
