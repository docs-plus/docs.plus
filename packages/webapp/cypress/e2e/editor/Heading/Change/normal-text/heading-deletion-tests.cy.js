import { TEST_TITLE, TEST_CONTENT } from '../../../../../support/commands'
import { section, paragraph, heading } from '../../../../../fixtures/docMaker'

// Complex nested document structure for testing
const ComplexDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short),
          // This is the heading we'll delete in different ways
          heading(4, 'Target Heading', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Expected structure after deleting "Target Heading" with backspace/delete at end
const expectedStructureAfterEndDeletion = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short),
          // Heading converted to paragraph
          paragraph('Target Heading'),
          paragraph(TEST_CONTENT.short),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Expected structure after deleting "Target Heading" with backspace/delete at start
// In this case, the content merges with parent heading
const expectedStructureAfterStartDeletion = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short + 'Target Heading' + TEST_CONTENT.short),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Expected structure after deleting "Target Heading" from the middle
const expectedStructureAfterMiddleDeletion = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short),
          // Only partial text remains
          paragraph('Heading'),
          paragraph(TEST_CONTENT.short),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Expected structure after merging the second section into the first section
const expectedStructureAfterSectionMerge = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Background', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Historical Context', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Key Concepts', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Target Heading', [paragraph(TEST_CONTENT.short)]),
          heading(4, 'Implementation Details', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Advanced Topics', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Deep Nested Heading', [paragraph(TEST_CONTENT.short)])
      ]),
      // Merged content from second section
      paragraph(TEST_CONTENT.short),
      heading(3, 'Another Branch', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Skipped Level', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

describe('Heading Deletion Tests', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'heading-deletion-tests-doc' })
  })

  it('should create a complex document with nested headings', () => {
    // Create the document
    cy.createDocument(ComplexDocumentStructure)

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  it('should delete heading using backspace at end of heading', () => {
    // Position cursor at the end of the heading we want to delete
    cy.putPosCaretInHeading(4, 'Target Heading', 'end')

    // Press backspace for each character in the heading text
    for (let i = 0; i < 'Target Heading'.length; i++) {
      cy.get('.docy_editor').realPress('Backspace')
    }

    // Press one more time to delete the heading structure
    cy.get('.docy_editor').realPress('Backspace')

    // Wait for changes to apply
    cy.wait(500)

    // Verify the heading no longer exists as a heading
    cy.get('.heading[level="4"] .title').contains('Target Heading').should('not.exist')

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  // it('should recreate the document for the next test', () => {
  //   // Clear the document and recreate it
  //   cy.createDocument(ComplexDocumentStructure)

  //   cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
  //     expect(result.valid).to.be.true
  //
  //   })
  // })

  // TODO: delete key is not working
  // it('should delete heading using delete key at end of heading', () => {
  //   // Position cursor at the end of the heading we want to delete
  //   cy.putPosCaretInHeading(4, 'Target Heading', 'end')

  //   // At the end of a heading, we need to press delete enough times to delete content after
  //   // the heading (the paragraph under the heading) plus one more to delete the heading structure
  //   const paragraphContentLength = TEST_CONTENT.short.length

  //   // Delete the content after the heading
  //   for (let i = 0; i < paragraphContentLength; i++) {
  //     cy.get('.docy_editor').realPress('Delete')
  //   }

  //   // Delete the heading structure
  //   cy.get('.docy_editor').realPress('Delete')

  //   // Wait for changes to apply
  //   cy.wait(500)

  //   // Verify the heading no longer exists as a heading
  //   cy.get('.heading[level="4"] .title').contains('Target Heading').should('not.exist')

  //   // Validate structure after deletion
  //   cy.validateDocumentStructure(expectedStructureAfterEndDeletion).then((result) => {
  //     expect(result.valid).to.be.true
  //
  //   })
  // })

  it('should recreate the document for the next test', () => {
    // Clear the document and recreate it
    cy.createDocument(ComplexDocumentStructure)

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  it('should merge content with parent when using backspace at start of heading', () => {
    // Position cursor at the start of the heading we want to delete
    cy.putPosCaretInHeading(4, 'Target Heading', 'start')

    // Press backspace once to delete the heading and merge content with parent
    cy.get('.docy_editor').realPress('Backspace')

    // Wait for changes to apply
    cy.wait(500)

    // Verify the heading no longer exists as a separate heading
    cy.get('.heading[level="4"] .title').contains('Target Heading').should('not.exist')

    // Verify the text is now part of the parent paragraph
    cy.get('.heading[level="3"]')
      .contains('Key Concepts')
      .closest('.heading[level="3"]')
      .contains(TEST_CONTENT.short + 'Target Heading')
      .should('exist')

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  it('should recreate the document for the next test', () => {
    // Clear the document and recreate it
    cy.createDocument(ComplexDocumentStructure)

    // Validate structure
    cy.validateDocumentStructure(ComplexDocumentStructure).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  // TODO: delete key is not working
  // it('should merge content with parent when using delete key at start of heading', () => {
  //   // Position cursor at the start of the heading we want to delete
  //   cy.putPosCaretInHeading(4, 'Target Heading', 'start')

  //   // Press delete once to delete the heading and merge content with parent
  //   cy.get('.docy_editor').realPress('Delete')

  //   // Wait for changes to apply
  //   cy.wait(500)

  //   // Verify the heading no longer exists as a separate heading
  //   cy.get('.heading[level="4"] .title').contains('Target Heading').should('not.exist')

  //   // Verify the text is now part of the parent paragraph
  //   cy.get('.heading[level="3"]')
  //     .contains('Key Concepts')
  //     .closest('.heading[level="3"]')
  //     .contains(TEST_CONTENT.short + 'Target Heading')
  //     .should('exist')

  //   // Validate the merged structure
  //   cy.validateDocumentStructure(expectedStructureAfterStartDeletion).then((result) => {
  //     expect(result.valid).to.be.true
  //
  //   })
  // })

  it('should delete heading when caret is in the middle and partial text remains', () => {
    // Position cursor in the middle of the heading we want to delete
    // We'll put it after "Target " to delete up to that point
    cy.putPosCaretInHeading(4, 'Target Heading', 7) // Position after "Target "

    // Press backspace for characters before the caret plus one for the heading structure
    for (let i = 0; i < 'Target '.length + 1; i++) {
      cy.get('.docy_editor').realPress('Backspace')
    }

    // Wait for changes to apply
    cy.wait(500)

    // Verify the heading no longer exists as a heading
    cy.get('.heading[level="4"] .title').contains('Target Heading').should('not.exist')

    // Verify only the remaining part of the text exists as a paragraph
    cy.get('p').contains('Heading').should('exist')
    cy.get('p').contains('Target Heading').should('not.exist')

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  it('should recreate the document for the next test', () => {
    // Clear the document and recreate it
    cy.createDocument(ComplexDocumentStructure)

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  it('should merge a section into a sibling section when using backspace at end', () => {
    // We need to position the cursor at the end of the first section
    // First, get the document structure and find the position

    cy.putPosCaretInHeading(1, 'Second Main Section', 'start')

    // Delete the section header
    cy.get('.docy_editor').realPress('Backspace')

    // Wait for changes to apply
    cy.wait(500)

    // Verify the second section no longer exists
    cy.get('.heading[level="1"] .title').contains('Second Main Section').should('not.exist')

    // Verify the content has been merged into the first section
    cy.get('p').contains('Second Main Section').should('exist')

    // Verify the content has been merged into the first section
    cy.get('.heading[level="1"]')
      .contains('Main Document Section')
      .closest('.heading[level="1"]')
      .contains('Another Branch')
      .should('exist')

    // Validate the merged structure
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })

  it('should validate DOM structure directly after all tests', () => {
    // Validate dom structure by traversing DOM elements
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true
    })
  })
})
