import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Collaboration Heading Sync (Flat Schema)', () => {
  beforeEach(() => {
    cy.visitEditor({ docName: 'collab-heading-sync-test', persist: true })
  })

  it('should create headings with stable data-toc-id in collab mode', () => {
    cy.clearEditor()

    cy.get('.docy_editor > .tiptap.ProseMirror').click().type('Collab Document{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('## Heading A{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Content A{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('## Heading B{enter}')
    cy.get('.docy_editor > .tiptap.ProseMirror').type('Content B')
    cy.wait(500)

    // BC-5: Each heading should have a unique, non-empty data-toc-id
    cy.get(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]').then(($els) => {
      const ids = new Set()
      $els.each((_, el) => {
        const id = el.getAttribute('data-toc-id')
        expect(id, 'data-toc-id').to.be.a('string')
        expect(id.length, 'data-toc-id length').to.be.greaterThan(0)
        expect(ids.has(id), `duplicate toc id: ${id}`).to.eq(false)
        ids.add(id)
      })
    })
  })

  it('should maintain document structure after heading operations', () => {
    const doc = {
      sections: [
        section('Sync Test', [
          heading(2, 'Alpha', [paragraph('Alpha content')]),
          heading(2, 'Beta', [paragraph('Beta content')]),
          heading(3, 'Gamma', [paragraph('Gamma content')])
        ])
      ]
    }

    cy.createDocument(doc)
    cy.wait(500)

    // Verify collaboration extensions loaded (editor should be editable)
    cy.get('.docy_editor > .tiptap.ProseMirror').should('have.attr', 'contenteditable', 'true')

    // Modify a heading
    cy.get('h2[data-toc-id]').contains('Alpha').click()
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress('End')
    cy.get('.docy_editor > .tiptap.ProseMirror').type(' Updated')
    cy.wait(300)

    // Verify the update
    cy.get('h2[data-toc-id]').should('contain', 'Alpha Updated')

    // Structure should be intact
    cy.get('h1[data-toc-id]').should('have.length', 1)
    cy.get('h2[data-toc-id]').should('have.length', 2)
    cy.get('h3[data-toc-id]').should('have.length', 1)
  })
})
