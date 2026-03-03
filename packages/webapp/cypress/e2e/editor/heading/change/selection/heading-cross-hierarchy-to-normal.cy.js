/* eslint-disable no-undef */
import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Document structure with complex nested hierarchies
const CrossHierarchyDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Hierarchy', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Branch', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'First Branch Child', [
          paragraph('Content in first branch child'),
          heading(4, 'Deep First Branch', [paragraph('Deep content')])
        ]),
        heading(3, 'First Branch Another Child', [
          paragraph('More content here'),
          heading(4, 'Another Deep Heading', [paragraph('More deep content')])
        ])
      ]),
      heading(2, 'Second Branch', [
        paragraph('Second branch content'),
        heading(3, 'Second Branch Child', [
          paragraph('Content in second branch child'),
          heading(4, 'Deep Second Branch', [paragraph('Deep second branch content')])
        ])
      ])
    ]),
    section('Second Hierarchy', [
      paragraph('Introduction to second hierarchy'),
      heading(2, 'Second Hierarchy First Branch', [
        paragraph('Content in second hierarchy first branch'),
        heading(3, 'Cross Selection Target Start', [
          paragraph('This is where cross selection starts')
        ]),
        heading(3, 'Cross Selection Middle', [
          paragraph('This is in the middle of cross selection')
        ])
      ]),
      heading(2, 'Second Hierarchy Second Branch', [
        paragraph('Content in second hierarchy second branch'),
        heading(3, 'Cross Selection Target End', [paragraph('This is where cross selection ends')]),
        heading(3, 'Not Selected', [paragraph('This should remain as a heading')])
      ])
    ])
  ]
}

// Expected structure after cross-branch selection
const crossBranchExpectedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Hierarchy', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Branch', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'First Branch Child', [
          paragraph('Content in first branch child'),
          heading(4, 'Deep First Branch', [paragraph('Deep content')])
        ]),
        heading(3, 'First Branch Another Child', [
          paragraph('More content here'),
          heading(4, 'Another Deep Heading', [paragraph('More deep content')])
        ])
      ]),
      heading(2, 'Second Branch', [
        paragraph('Second branch content'),
        heading(3, 'Second Branch Child', [
          paragraph('Content in second branch child'),
          heading(4, 'Deep Second Branch', [paragraph('Deep second branch content')])
        ])
      ])
    ]),
    section('Second Hierarchy', [
      paragraph('Introduction to second hierarchy'),
      heading(2, 'Second Hierarchy First Branch', [
        paragraph('Content in second hierarchy first branch'),
        // Converted to paragraph
        paragraph('Cross Selection Target Start'),
        paragraph('This is where cross selection starts'),
        // Converted to paragraph
        paragraph('Cross Selection Middle'),
        paragraph('This is in the middle of cross selection')
      ]),
      heading(2, 'Second Hierarchy Second Branch', [
        paragraph('Content in second hierarchy second branch'),
        // Converted to paragraph
        paragraph('Cross Selection Target End'),
        paragraph('This is where cross selection ends'),
        heading(3, 'Not Selected', [paragraph('This should remain as a heading')])
      ])
    ])
  ]
}

// Expected structure after deep cross-hierarchy selection
const deepCrossHierarchyExpectedStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Hierarchy', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Branch', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'First Branch Child', [
          paragraph('Content in first branch child'),
          // Converted to paragraph
          paragraph('Deep First Branch'),
          paragraph('Deep content')
        ]),
        heading(3, 'First Branch Another Child', [
          paragraph('More content here'),
          // Converted to paragraph
          paragraph('Another Deep Heading'),
          paragraph('More deep content')
        ])
      ]),
      heading(2, 'Second Branch', [
        paragraph('Second branch content'),
        heading(3, 'Second Branch Child', [
          paragraph('Content in second branch child'),
          // Converted to paragraph
          paragraph('Deep Second Branch'),
          paragraph('Deep second branch content')
        ])
      ])
    ]),
    section('Second Hierarchy', [
      paragraph('Introduction to second hierarchy'),
      heading(2, 'Second Hierarchy First Branch', [
        paragraph('Content in second hierarchy first branch'),
        heading(3, 'Cross Selection Target Start', [
          paragraph('This is where cross selection starts')
        ]),
        heading(3, 'Cross Selection Middle', [
          paragraph('This is in the middle of cross selection')
        ])
      ]),
      heading(2, 'Second Hierarchy Second Branch', [
        paragraph('Content in second hierarchy second branch'),
        heading(3, 'Cross Selection Target End', [paragraph('This is where cross selection ends')]),
        heading(3, 'Not Selected', [paragraph('This should remain as a heading')])
      ])
    ])
  ]
}

describe('Convert Cross-Hierarchy Selections to Normal Text', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
  })

  it('should create a complex document with multiple hierarchies', () => {
    // Create the document
    cy.createDocument(CrossHierarchyDocumentStructure)

    // Validate initial document structure
    cy.validateDocumentStructure(CrossHierarchyDocumentStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should convert headings of the same level across different parent branches', () => {
    // Create selection that spans headings across different parent headings
    cy.createSelection({
      startHeading: { level: 3, title: 'Cross Selection Target Start' },
      startPosition: 'start',
      endHeading: { level: 3, title: 'Cross Selection Target End' },
      endPosition: 'end'
    })

    // Use Meta+Option+0 shortcut to convert headings to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)

    // Verify the selected headings were converted to normal text
    cy.get('.heading[level="3"] .title')
      .contains('Cross Selection Target Start')
      .should('not.exist')
    cy.get('.heading[level="3"] .title').contains('Cross Selection Middle').should('not.exist')
    cy.get('.heading[level="3"] .title').contains('Cross Selection Target End').should('not.exist')

    // Verify the unselected heading remains
    cy.get('.heading[level="3"] .title').contains('Not Selected').should('exist')

    // Verify the converted headings now appear as paragraphs
    cy.get('p').contains('Cross Selection Target Start').should('exist')
    cy.get('p').contains('Cross Selection Middle').should('exist')
    cy.get('p').contains('Cross Selection Target End').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(crossBranchExpectedStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should convert all headings of a specific level across the entire document', () => {
    // Create a selection that includes all level 4 headings
    cy.createSelection({
      startHeading: { level: 4, title: 'Deep First Branch' },
      startPosition: 'start',
      endHeading: { level: 4, title: 'Deep Second Branch' },
      endPosition: 'end'
    })

    // Use Meta+Option+0 shortcut to convert headings to normal text
    cy.get('.docy_editor').realPress(['Alt', 'Meta', '0'])

    // Wait for changes to apply
    cy.wait(500)

    // Verify all level 4 headings were converted to normal text
    cy.get('.heading[level="4"]').should('not.exist')

    // Verify the converted headings now appear as paragraphs
    cy.get('p').contains('Deep First Branch').should('exist')
    cy.get('p').contains('Another Deep Heading').should('exist')
    cy.get('p').contains('Deep Second Branch').should('exist')

    // Validate structure after conversion
    cy.validateDocumentStructure(deepCrossHierarchyExpectedStructure).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).to.be.undefined
    })
  })

  it('should maintain valid document structure after complex conversions', () => {
    // Validate DOM structure remains valid
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors).have.length(0)
    })

    // Additional verification of specific elements
    cy.get('.docy_editor').within(() => {
      // Verify level 1 headings (sections) remain intact
      cy.get('.heading[level="1"]').should('have.length', 2)

      // Verify level 2 headings
      cy.get('.heading[level="2"]').should('have.length', 2)

      // Verify level 3 headings - some were converted, some remain
      cy.get('.heading[level="3"]').should('have.length', 2) // The remaining ones

      // Verify level 4 headings - all should be converted to paragraphs
      cy.get('.heading[level="4"]').should('not.exist')

      // Check document coherence by verifying parent-child relationships
      cy.get('.heading[level="2"]')
        .contains('First Branch')
        .closest('.heading[level="2"]')
        .within(() => {
          // Verify child headings exist
          cy.get('.heading[level="3"]').should('have.length', 1)

          // Verify converted headings are now paragraphs
          cy.get('p').contains('Deep First Branch').should('exist')
          cy.get('p').contains('Another Deep Heading').should('exist')
        })
    })
  })
})
