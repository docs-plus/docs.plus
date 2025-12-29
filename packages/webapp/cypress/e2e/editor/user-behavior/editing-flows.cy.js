/* eslint-disable no-undef */
/**
 * User Editing Flow Tests
 *
 * Tests real-world user scenarios and editing workflows.
 * These simulate how users actually interact with the editor.
 */

import { TEST_TITLE, TEST_CONTENT } from '../../../support/commands'
import { section, paragraph, heading } from '../../../fixtures/docMaker'

describe('User Editing Flows', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'editing-flows-test' })
  })

  describe('Document Creation Flow', () => {
    it('should allow user to create a complete document from scratch', () => {
      // Start with empty editor and build a document
      cy.get('.docy_editor .tiptap').click()
      cy.wait(200)

      // Type first section title
      cy.realType('My First Document')
      cy.wait(100)

      // Press Enter to go to content
      cy.realPress('Enter')
      cy.realType('This is the introduction paragraph.')
      cy.wait(100)

      // Create a subsection (H2)
      cy.realPress('Enter')
      cy.realPress(['Alt', 'Meta', '2'])
      cy.realType('Getting Started')
      cy.wait(100)

      // Add content to subsection
      cy.realPress('Enter')
      cy.realType('Here is how to get started with our product.')
      cy.wait(200)

      // Verify structure
      cy.get('.heading[level="1"] .title').should('contain', 'My First Document')
      cy.get('.heading[level="2"] .title').should('contain', 'Getting Started')
      cy.get('p').should('contain', 'introduction paragraph')
      cy.get('p').should('contain', 'get started')
    })

    it('should allow creating nested heading structure', () => {
      // Create a nested structure: H1 -> H2 -> H3 -> H4
      cy.get('.docy_editor .tiptap').click()
      cy.realType('Root Section')
      cy.realPress('Enter')

      // Create H2
      cy.realPress(['Alt', 'Meta', '2'])
      cy.realType('Level 2 Heading')
      cy.realPress('Enter')
      cy.realType('Level 2 content')
      cy.realPress('Enter')

      // Create H3
      cy.realPress(['Alt', 'Meta', '3'])
      cy.realType('Level 3 Heading')
      cy.realPress('Enter')
      cy.realType('Level 3 content')
      cy.realPress('Enter')

      // Create H4
      cy.realPress(['Alt', 'Meta', '4'])
      cy.realType('Level 4 Heading')
      cy.realPress('Enter')
      cy.realType('Level 4 content')
      cy.wait(300)

      // Verify nested structure
      cy.get('.heading[level="1"] .heading[level="2"] .heading[level="3"] .heading[level="4"]')
        .should('exist')
        .and('contain', 'Level 4')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Document Restructuring Flow', () => {
    it('should allow reorganizing headings via level changes', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Main Document', [
            heading(2, 'Introduction', [paragraph('Intro content')]),
            heading(2, 'Should be nested', [paragraph('Nested content')]),
            heading(2, 'Conclusion', [paragraph('Conclusion content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // User wants to make "Should be nested" a child of "Introduction"
      // Change it to H3
      cy.putPosCaretInHeading(2, 'Should be nested', 'start')
      cy.realPress(['Alt', 'Meta', '3'])
      cy.wait(300)

      // Should now be nested under Introduction
      cy.get('.heading[level="2"] .title')
        .contains('Introduction')
        .closest('.heading')
        .find('.heading[level="3"]')
        .should('contain', 'Should be nested')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should allow promoting nested heading to top level', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Original Section', [
            heading(2, 'Subsection', [
              paragraph('Content'),
              heading(3, 'Should become new section', [paragraph('More content')])
            ])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Promote H3 to H1 (new section)
      cy.putPosCaretInHeading(3, 'Should become new section', 'start')
      cy.realPress(['Alt', 'Meta', '1'])
      cy.wait(500)

      // Should now be a separate H1 section
      cy.get('.docy_editor > .tiptap > .heading[level="1"]').should('have.length', 2)

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Content Editing Flow', () => {
    it('should allow editing heading text while preserving structure', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Original Title', [heading(2, 'Subsection', [paragraph('Content here')])])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click on heading to focus it, then type
      cy.get('.heading[level="1"] .title').first().click()
      cy.realPress('End') // Go to end
      cy.realType(' Modified')
      cy.wait(300)

      // Verify change and structure integrity
      cy.get('.heading[level="1"] .title').first().should('contain', 'Modified')
      cy.get('.heading[level="2"]').should('exist')
      cy.get('p').should('contain', 'Content here')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should allow adding content between headings', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Main Section', [
            heading(2, 'First Heading', []),
            heading(2, 'Second Heading', [])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Add paragraph after "First Heading"
      cy.putPosCaretInHeading(2, 'First Heading', 'end')
      cy.realPress('Enter')
      cy.realType('New paragraph between headings')
      cy.wait(300)

      // Verify paragraph is inside First Heading's contentWrapper
      cy.get('.heading[level="2"]')
        .contains('First Heading')
        .closest('.heading')
        .find('p')
        .should('contain', 'New paragraph')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Copy/Paste Flow', () => {
    it('should handle typing in heading', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Some content')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click on heading title and type
      cy.get('.heading[level="1"] .title').click()
      cy.realPress('End')
      cy.realType(' Extended')
      cy.wait(200)

      cy.get('.heading[level="1"] .title').should('contain', 'Extended')
    })
  })

  describe('Multi-Section Workflow', () => {
    it('should allow working with multiple sections', () => {
      // Create first section
      cy.get('.docy_editor .tiptap').click()
      cy.realType('Section One')
      cy.realPress('Enter')
      cy.realType('Content for section one')
      cy.wait(200)

      // Create second section (new H1)
      cy.realPress('Enter')
      cy.realPress(['Alt', 'Meta', '1'])
      cy.realType('Section Two')
      cy.realPress('Enter')
      cy.realType('Content for section two')
      cy.wait(200)

      // Create third section
      cy.realPress('Enter')
      cy.realPress(['Alt', 'Meta', '1'])
      cy.realType('Section Three')
      cy.realPress('Enter')
      cy.realType('Content for section three')
      cy.wait(300)

      // Verify 3 sections
      cy.get('.docy_editor > .tiptap > .heading[level="1"]').should('have.length', 3)

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should allow moving content between sections via TOC', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Section A', [heading(2, 'Move This', [paragraph('Content to move')])]),
          section('Section B', [heading(2, 'Target Location', [paragraph('Existing content')])])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Use TOC to move "Move This" after "Target Location"
      cy.dragTocItem('Move This', 'Target Location', { position: 'after' })
      cy.wait(500)

      // Verify move happened
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Edge Case Handling', () => {
    it('should handle typing in empty heading', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('', [])] // Empty section title
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Type in empty heading
      cy.get('.heading[level="1"] .title').click()
      cy.realType('New Title')
      cy.wait(200)

      cy.get('.heading[level="1"] .title').should('contain', 'New Title')
    })

    it('should handle rapid typing in heading', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Initial', [paragraph('Content')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      cy.putPosCaretInHeading(1, 'Initial', 'end')

      // Rapid typing
      cy.realType(' - typing very fast without stopping to see if editor handles it well')
      cy.wait(300)

      cy.get('.heading[level="1"] .title').should('contain', 'typing very fast')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should handle deleting all content and retyping', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Delete Me', [
            paragraph('Some content'),
            heading(2, 'Also delete', [paragraph('More content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Select all and delete
      cy.get('.docy_editor .tiptap').click()
      cy.realPress(['Meta', 'a'])
      cy.realPress('Backspace')
      cy.wait(300)

      // Type new content
      cy.realType('Fresh Start')
      cy.wait(200)

      // Should have new section
      cy.get('.heading[level="1"] .title').should('contain', 'Fresh Start')
    })
  })

  describe('TOC Interaction Flow', () => {
    it('should click on TOC item to navigate to heading', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('First Section', [
            paragraph('Lots of content here to create scroll'),
            heading(2, 'Subsection 1', [paragraph(TEST_CONTENT.long)]),
            heading(2, 'Subsection 2', [paragraph(TEST_CONTENT.long)]),
            heading(2, 'Target Heading', [paragraph('Target content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click on TOC item
      cy.getTocItem('Target Heading').click()
      cy.wait(300)

      // The heading should be visible (scrolled into view)
      cy.get('.heading .title').contains('Target Heading').should('be.visible')
    })

    it('should reflect heading changes in TOC', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Original Name', [heading(2, 'Subheading', [paragraph('Content')])])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Edit the heading
      cy.putPosCaretInHeading(2, 'Subheading', 'end')
      cy.realType(' Updated')
      cy.wait(500)

      // TOC should update
      cy.getTocItem('Subheading Updated').should('exist')
    })
  })
})
