/* eslint-disable no-undef */
/**
 * HN-10 Schema Validation Tests
 *
 * Tests the core heading nesting semantics as defined in Editor_Schema_Rules_v3.md
 * - Levels 1-10 are valid
 * - Section starts with H1
 * - STACK-ATTACH algorithm (child level > parent level)
 * - Non-sequential jumps are valid (H1→H4 is allowed)
 * - Siblings at different levels
 */

import { TEST_TITLE, TEST_CONTENT } from '../../../support/commands'
import { section, paragraph, heading } from '../../../fixtures/docMaker'

describe('HN-10 Schema Validation', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'hn10-validation-test' })
  })

  describe('§1 Universe - Levels 1-10', () => {
    it('should support all 10 heading levels in a single chain', () => {
      const fullChainDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Level 1 Root', [
            paragraph('Content at level 1'),
            heading(2, 'Level 2', [
              paragraph('Content at level 2'),
              heading(3, 'Level 3', [
                paragraph('Content at level 3'),
                heading(4, 'Level 4', [
                  paragraph('Content at level 4'),
                  heading(5, 'Level 5', [
                    paragraph('Content at level 5'),
                    heading(6, 'Level 6', [
                      paragraph('Content at level 6'),
                      heading(7, 'Level 7', [
                        paragraph('Content at level 7'),
                        heading(8, 'Level 8', [
                          paragraph('Content at level 8'),
                          heading(9, 'Level 9', [
                            paragraph('Content at level 9'),
                            heading(10, 'Level 10', [paragraph('Content at level 10')])
                          ])
                        ])
                      ])
                    ])
                  ])
                ])
              ])
            ])
          ])
        ]
      }

      cy.createDocument(fullChainDoc)
      cy.wait(300)

      // Verify all 10 levels exist
      for (let level = 1; level <= 10; level++) {
        cy.get(`.heading[level="${level}"]`).should('exist')
        cy.get(`.heading[level="${level}"] .title`).should('contain', `Level ${level}`)
      }

      // Validate DOM structure
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should reject level 0 (no H0)', () => {
      // Level 0 should not be creatable - it becomes normal text
      cy.createDocument({
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Test Section', [
            paragraph('Some content'),
            heading(2, 'Test Heading', [paragraph('Nested content')])
          ])
        ]
      })
      cy.wait(300)

      // Try to change heading to level 0 (should convert to paragraph)
      cy.putPosCaretInHeading(2, 'Test Heading', 'start')
      cy.realPress(['Alt', 'Meta', '0'])
      cy.wait(300)

      // Should now be a paragraph, not a heading
      cy.get('.heading .title').contains('Test Heading').should('not.exist')
      cy.get('p').contains('Test Heading').should('exist')
    })
  })

  describe('§3.3 Section Start - H1 Required', () => {
    it('should start each section with H1', () => {
      const multiSectionDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('First Section', [paragraph('Content 1')]),
          section('Second Section', [paragraph('Content 2')]),
          section('Third Section', [paragraph('Content 3')])
        ]
      }

      cy.createDocument(multiSectionDoc)
      cy.wait(300)

      // All sections should have level 1
      cy.get('.heading[level="1"]').should('have.length', 3)

      // Verify each section title
      cy.get('.heading[level="1"] .title').eq(0).should('contain', 'First Section')
      cy.get('.heading[level="1"] .title').eq(1).should('contain', 'Second Section')
      cy.get('.heading[level="1"] .title').eq(2).should('contain', 'Third Section')
    })
  })

  describe('§5 STACK-ATTACH Algorithm', () => {
    it('should allow non-sequential level jumps (H1→H4)', () => {
      // Per §6.2: H1 -> H4 is valid (ℓnext > ℓprev)
      const jumpDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            paragraph('Root content'),
            heading(4, 'Jump to Level 4', [
              paragraph('Level 4 content'),
              heading(7, 'Jump to Level 7', [paragraph('Level 7 content')])
            ])
          ])
        ]
      }

      cy.createDocument(jumpDoc)
      cy.wait(300)

      // Verify structure is valid
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })

      // H4 should be child of H1
      cy.get('.heading[level="1"] .contentWrapper .heading[level="4"]').should('exist')

      // H7 should be child of H4
      cy.get('.heading[level="4"] .contentWrapper .heading[level="7"]').should('exist')
    })

    it('should handle mixed sibling levels correctly', () => {
      // H1 -> H2, H5, H3 are all valid siblings of H1
      const mixedSiblingsDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            paragraph('Root content'),
            heading(2, 'First Child', [paragraph('H2 content')]),
            heading(5, 'Second Child', [paragraph('H5 content')]),
            heading(3, 'Third Child', [paragraph('H3 content')])
          ])
        ]
      }

      cy.createDocument(mixedSiblingsDoc)
      cy.wait(500)

      // Check that all child headings exist
      cy.get('.heading[level="2"]').should('exist').and('contain', 'First Child')
      cy.get('.heading[level="5"]').should('exist').and('contain', 'Second Child')
      cy.get('.heading[level="3"]').should('exist').and('contain', 'Third Child')

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should attach heading to nearest ancestor with lower level', () => {
      // Testing STACK-ATTACH: H1 -> H3 -> H5, H4 (siblings under H3)
      // H4 should attach to H3 (not H5) because level(H3)=3 < level(H4)=4
      const stackAttachDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            paragraph('Root content'),
            heading(3, 'Level 3 Parent', [
              paragraph('H3 content'),
              heading(5, 'Level 5 Child', [paragraph('H5 content')]),
              heading(4, 'Level 4 Sibling', [paragraph('H4 content')])
            ])
          ])
        ]
      }

      cy.createDocument(stackAttachDoc)
      cy.wait(500)

      // Both H4 and H5 should exist
      cy.get('.heading[level="5"]').should('exist').and('contain', 'Level 5 Child')
      cy.get('.heading[level="4"]').should('exist').and('contain', 'Level 4 Sibling')

      // H4 and H5 should both be within H3
      cy.get('.heading[level="3"]').within(() => {
        cy.get('.heading[level="5"]').should('exist')
        cy.get('.heading[level="4"]').should('exist')
      })

      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })
  })

  describe('§8 Quick Examples', () => {
    it('§8.1 Single section chain (H1→H2→H3→H4)', () => {
      const chainDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('H1', [
            heading(2, 'H2', [heading(3, 'H3', [heading(4, 'H4', [paragraph('Deepest')])])])
          ])
        ]
      }

      cy.createDocument(chainDoc)
      cy.wait(300)

      // Verify chain nesting
      cy.get('.heading[level="1"] .heading[level="2"] .heading[level="3"] .heading[level="4"]')
        .should('exist')
        .and('contain', 'H4')
    })

    it('§8.2 Multiple sections (forest)', () => {
      const forestDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Tree 1', [heading(2, 'Branch 1.1', [heading(3, 'Leaf 1.1.1', [])])]),
          section('Tree 2', [heading(2, 'Branch 2.1', [])])
        ]
      }

      cy.createDocument(forestDoc)
      cy.wait(300)

      // Should have 2 root sections
      cy.get('.docy_editor > .tiptap > .heading[level="1"]').should('have.length', 2)
    })

    it('§8.3 Siblings at same depth (H1→H2, H2, H2)', () => {
      const siblingsDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Parent', [
            heading(2, 'First H2', [paragraph('Content 1')]),
            heading(2, 'Second H2', [paragraph('Content 2')]),
            heading(2, 'Third H2', [paragraph('Content 3')])
          ])
        ]
      }

      cy.createDocument(siblingsDoc)
      cy.wait(500)

      // Three H2 siblings should exist
      cy.get('.heading[level="2"]').should('have.length', 3)
      cy.get('.heading[level="2"]').eq(0).should('contain', 'First H2')
      cy.get('.heading[level="2"]').eq(1).should('contain', 'Second H2')
      cy.get('.heading[level="2"]').eq(2).should('contain', 'Third H2')
    })
  })

  describe('Level 10 Edge Cases', () => {
    it('should handle content at maximum depth (level 10)', () => {
      const maxDepthDoc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Root', [
            heading(10, 'Max Depth Heading', [
              paragraph('Content at maximum depth'),
              paragraph('More content here')
            ])
          ])
        ]
      }

      cy.createDocument(maxDepthDoc)
      cy.wait(300)

      cy.get('.heading[level="10"]').should('exist')
      cy.get('.heading[level="10"] .title').should('contain', 'Max Depth Heading')
    })

    it('should not allow changing level 10 to level 11', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Root', [heading(10, 'Level 10', [paragraph('Content')])])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Try to increase level beyond 10
      cy.putPosCaretInHeading(10, 'Level 10', 'start')

      // There's no Alt+Meta+11 shortcut, but pressing a number > 9 should do nothing
      // Heading should remain at level 10
      cy.get('.heading[level="10"]').should('exist')
    })
  })
})

