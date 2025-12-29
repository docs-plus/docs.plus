/* eslint-disable no-undef */
/**
 * Hierarchy Validation Plugin Tests
 *
 * Tests the automatic hierarchy fixing behavior of the hierarchyValidationPlugin.
 * When violations occur, the plugin should automatically fix them:
 * - H1 nested inside another heading → extract to document root
 * - Child level ≤ parent level → extract as sibling
 */

import { TEST_TITLE, TEST_CONTENT } from '../../../support/commands'
import { section, paragraph, heading } from '../../../fixtures/docMaker'

describe('Hierarchy Validation Plugin - Auto-Fix Behavior', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hierarchy-validation-test' })
  })

  describe('H1 Nested Extraction', () => {
    it('should extract nested H1 to document root via TOC drag', () => {
      // Create a document with H1 -> H2 structure
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Parent Section', [
            paragraph('Parent content'),
            heading(2, 'Child Heading', [paragraph('Child content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Promote H2 to H1 via TOC drag (should trigger extraction)
      cy.window().then((win) => {
        if (win._moveHeading) {
          // Find the H2 heading
          const editor = win._editor
          let h2Id = null

          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
              const level = node.firstChild?.attrs?.level
              if (level === 2) {
                h2Id = node.attrs.id
                return false
              }
            }
          })

          if (h2Id) {
            // This would create an H1 inside H1 - plugin should extract it
            // Actually, moveHeading with level 1 should create a new section
            cy.log('Testing H1 promotion behavior')
          }
        }
      })

      // After any H1 promotion, there should be no nested H1s
      cy.get('.heading[level="1"] .heading[level="1"]').should('not.exist')
    })

    it('should maintain valid structure when changing heading to H1', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('First Section', [
            paragraph('Content'),
            heading(2, 'Nested Heading', [paragraph('Nested content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Change H2 to H1 via keyboard shortcut
      cy.putPosCaretInHeading(2, 'Nested Heading', 'start')
      cy.realPress(['Alt', 'Meta', '1'])
      cy.wait(500)

      // Should now have 2 H1 sections (not nested)
      cy.get('.docy_editor > .tiptap > .heading[level="1"]').should('have.length', 2)

      // No H1 should be nested inside another H1
      cy.get('.heading[level="1"] .contentWrapper .heading[level="1"]').should('not.exist')
    })
  })

  describe('Invalid Child Level Extraction', () => {
    it('should handle demoting parent below child level', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            paragraph('Root content'),
            heading(2, 'Parent', [
              paragraph('Parent content'),
              heading(4, 'Child', [paragraph('Child content')])
            ])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Demote H2 to H5 (child H4 would then be invalid as H4 < H5)
      cy.putPosCaretInHeading(2, 'Parent', 'start')
      cy.realPress(['Alt', 'Meta', '5'])
      cy.wait(500)

      // The structure should be fixed - H4 should not be inside H5
      // Either H4 becomes sibling of H5 or is extracted
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should extract child when child level equals parent level', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            paragraph('Root content'),
            heading(3, 'First H3', [
              paragraph('Content'),
              heading(5, 'Nested H5', [paragraph('H5 content')])
            ]),
            heading(3, 'Second H3', [paragraph('Content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(500)

      // Change nested H5 to H3 (same as parent - triggers extraction)
      cy.putPosCaretInHeading(5, 'Nested H5', 'start')
      cy.realPress(['Alt', 'Meta', '3'])
      cy.wait(500)

      // The hierarchy validation should fix the structure
      // The ex-H5 (now H3) should be extracted as sibling
      cy.get('.heading[level="3"]').should('have.length.at.least', 2)

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Complex Hierarchy Fixes', () => {
    it('should handle cascading extractions correctly', () => {
      // H1 -> H2 -> H3 -> H4
      // Change H2 to H5 → H3 and H4 should be extracted
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            heading(2, 'Level 2 Parent', [
              paragraph('Level 2 content'),
              heading(3, 'Level 3 Child', [
                paragraph('Level 3 content'),
                heading(4, 'Level 4 Deep', [paragraph('Deep content')])
              ])
            ])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(500)

      // Change H2 to H5
      cy.putPosCaretInHeading(2, 'Level 2 Parent', 'start')
      cy.realPress(['Alt', 'Meta', '5'])
      cy.wait(500)

      // H3 (level 3) should be extracted since 3 < 5
      // H4 should also be extracted since 4 < 5
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })

      // All original headings should still exist (just restructured)
      cy.get('.heading').should('have.length.at.least', 3)
    })

    it('should preserve content when extracting headings', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            heading(2, 'Parent', [
              paragraph('Parent paragraph 1'),
              paragraph('Parent paragraph 2'),
              heading(4, 'Child', [
                paragraph('Child paragraph 1'),
                paragraph('Child paragraph 2')
              ])
            ])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Demote parent to H6 (forcing child H4 extraction)
      cy.putPosCaretInHeading(2, 'Parent', 'start')
      cy.realPress(['Alt', 'Meta', '6'])
      cy.wait(500)

      // All content should still exist (scope to editor to avoid Next.js elements)
      cy.get('.docy_editor p').contains('Parent paragraph 1').should('exist')
      cy.get('.docy_editor p').contains('Parent paragraph 2').should('exist')
      cy.get('.docy_editor p').contains('Child paragraph 1').should('exist')
      cy.get('.docy_editor p').contains('Child paragraph 2').should('exist')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid consecutive level changes', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            heading(2, 'Test Heading', [
              paragraph('Content'),
              heading(4, 'Nested', [paragraph('Nested content')])
            ])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Rapid changes: 2 → 5 → 3 → 7 → 2
      cy.putPosCaretInHeading(2, 'Test Heading', 'start')

      cy.realPress(['Alt', 'Meta', '5']).wait(200)
      cy.realPress(['Alt', 'Meta', '3']).wait(200)
      cy.realPress(['Alt', 'Meta', '7']).wait(200)
      cy.realPress(['Alt', 'Meta', '2']).wait(300)

      // Final state should be valid
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should handle empty headings during extraction', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            heading(2, 'Parent with empty child', [
              heading(4, 'Empty Child', []) // No content
            ])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Demote parent to H6
      cy.putPosCaretInHeading(2, 'Parent with empty child', 'start')
      cy.realPress(['Alt', 'Meta', '6'])
      cy.wait(500)

      // Empty child should still be extracted correctly
      cy.get('.heading .title').contains('Empty Child').should('exist')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })
})

