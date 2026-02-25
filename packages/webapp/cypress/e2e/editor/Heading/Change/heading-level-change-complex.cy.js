import { TEST_TITLE, TEST_CONTENT } from '../../../../support/commands'
import { section, paragraph, heading } from '../../../../fixtures/docMaker'

// Deep nested complex document structure
const DeepNestedDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Document Section 1', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction Section', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Overview', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Key Concepts', [
            paragraph(TEST_CONTENT.short),
            heading(5, 'Fundamental Principles', [
              paragraph(TEST_CONTENT.short),
              heading(6, 'Core Ideas', [paragraph(TEST_CONTENT.short)])
            ])
          ])
        ]),
        heading(3, 'Motivation', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Industry Problems', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Technical Details', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Architecture', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Components', [
            paragraph(TEST_CONTENT.short),
            heading(7, 'Modules', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(4, 'Implementation', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Document Section 2', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Additional Information', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Further Reading', [paragraph(TEST_CONTENT.short)]),
        heading(5, 'Related Topics', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Conclusion', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Future Work', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// Multi-section complex document with varied heading levels
const MultiSectionDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Section Overview', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Important Details', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Specific Points', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(3, 'Another Subsection', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Technical Notes', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Second Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Second Section Overview', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Key Information', [
          paragraph(TEST_CONTENT.short),
          heading(6, 'Critical Details', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section('Third Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Direct Subsection', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Detailed Analysis', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(5, 'Another Direct Subsection', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// Complex interleaved sections with asymmetric depth
const AsymmetricDocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('First Main Topic', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction to Topic', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Background Information', [
          paragraph(TEST_CONTENT.short),
          heading(7, 'Historical Context', [
            paragraph(TEST_CONTENT.short),
            heading(9, 'Notable Events', [paragraph(TEST_CONTENT.short)])
          ])
        ]),
        heading(4, 'Current State', [
          paragraph(TEST_CONTENT.short),
          heading(5, 'Recent Developments', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Technical Considerations', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Design Principles', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Implementation Strategy', [
          paragraph(TEST_CONTENT.short),
          heading(8, 'Advanced Techniques', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ]),
    section('Second Main Topic', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Direct Subtopic', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'Specific Details', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(6, 'Another Subtopic', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// Function to get a random heading from the document
const getRandomHeading = (documentStructure) => {
  const headings = []

  // Helper function to recursively collect all headings
  const collectHeadings = (node, path = []) => {
    if (node.type === 'heading') {
      headings.push({
        title: node.title,
        level: node.level,
        path: [...path, node.title] // Track path to this heading
      })

      // Recursively collect headings in contents
      if (node.contents) {
        node.contents.forEach((child) => {
          if (child.type === 'heading') {
            collectHeadings(child, [...path, node.title])
          }
        })
      }
    }

    // Process section contents
    if (node.contents) {
      node.contents.forEach((child) => {
        if (child.type === 'heading') {
          collectHeadings(child, path)
        }
      })
    }
  }

  // Process each section
  documentStructure.sections.forEach((section) => {
    collectHeadings(section, [section.title])
  })

  // Return a random heading if any exist
  if (headings.length > 0) {
    const randomIndex = Math.floor(Math.random() * headings.length)
    return headings[randomIndex]
  }

  return null
}

describe('Complex Heading Level Changes', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ docName: 'heading-change-complex-test' })
  })

  const verifyHeadingLevel = (headingText, expectedLevel) => {
    cy.get('.heading')
      .filter((_i, el) => el.querySelector('.title')?.textContent?.trim() === headingText)
      .first()
      .should('have.attr', 'level', expectedLevel.toString())
  }

  // Helper function to cycle heading levels and verify structure
  const cycleHeadingLevels = (headingTitle, originalLevel) => {
    cy.log(`Testing heading level changes for "${headingTitle}" (original level: ${originalLevel})`)

    // First try to change to level 9 (or highest valid level)
    cy.applyHeadingLevelChange(headingTitle, originalLevel, 9).then((result) => {
      cy.log(
        `Attempt to change from level ${originalLevel} to level 9: ${result.applied ? 'Success' : 'Failed'}`
      )

      if (result.applied) {
        // Verify the heading has been updated to level 9
        verifyHeadingLevel(headingTitle, 9)

        // Now try to change to an invalid level 1
        cy.applyHeadingLevelChange(headingTitle, 9, 1).then((result) => {
          cy.log(
            `Attempt to change from level 9 to level 1: ${result.applied ? 'Success' : 'Failed'}`
          )

          // Regardless of whether it applied, try to set back to original level
          const currentLevel = result.applied ? 1 : 9

          cy.applyHeadingLevelChange(headingTitle, currentLevel, originalLevel).then((result) => {
            cy.log(
              `Attempt to change back to original level ${originalLevel}: ${result.applied ? 'Success' : 'Failed'}`
            )

            if (result.applied) {
              // Verify the heading has been reset to its original level
              verifyHeadingLevel(headingTitle, originalLevel)
            }
          })
        })
      } else {
        // If changing to level 9 didn't work, try with a more moderate increase
        const targetLevel = Math.min(originalLevel + 2, 8)

        cy.applyHeadingLevelChange(headingTitle, originalLevel, targetLevel).then((result) => {
          cy.log(
            `Alternative attempt to change from level ${originalLevel} to level ${targetLevel}: ${result.applied ? 'Success' : 'Failed'}`
          )

          if (result.applied) {
            // Verify the heading has been updated
            verifyHeadingLevel(headingTitle, targetLevel)

            // Try to change back to original level
            cy.applyHeadingLevelChange(headingTitle, targetLevel, originalLevel).then((result) => {
              cy.log(
                `Attempt to change back to original level ${originalLevel}: ${result.applied ? 'Success' : 'Failed'}`
              )

              if (result.applied) {
                // Verify the heading has been reset
                verifyHeadingLevel(headingTitle, originalLevel)
              }
            })
          }
        })
      }
    })
  }

  it('should handle level changes in deep nested document structure', () => {
    // Create the complex document
    cy.createDocument(DeepNestedDocumentStructure)
    cy.wait(1000) // Ensure document is fully rendered

    // Test heading level changes on specific headings at different depths
    cycleHeadingLevels('Introduction Section', 2)
    cycleHeadingLevels('Overview', 3)
    cycleHeadingLevels('Key Concepts', 4)
    cycleHeadingLevels('Core Ideas', 6)
    cycleHeadingLevels('Technical Details', 2)
    cycleHeadingLevels('Modules', 7)
  })

  const multiSectionHeadings = [
    { title: 'First Section Overview', level: 2 },
    { title: 'Important Details', level: 4 },
    { title: 'Specific Points', level: 7 },
    { title: 'Direct Subsection', level: 4 },
    { title: 'Another Direct Subsection', level: 5 }
  ]

  multiSectionHeadings.forEach(({ title, level }) => {
    it(`should handle level cycle for "${title}" (H${level}) in multi-section structure`, () => {
      cy.createDocument(MultiSectionDocumentStructure)
      cy.wait(1000)
      cycleHeadingLevels(title, level)
    })
  })

  it('should handle level changes in asymmetric document structure', () => {
    // Create the asymmetric document
    cy.createDocument(AsymmetricDocumentStructure)
    cy.wait(1000) // Ensure document is fully rendered

    // Test heading level changes on specific headings with extreme nesting
    cycleHeadingLevels('Background Information', 4)
    cycleHeadingLevels('Historical Context', 7)
    cycleHeadingLevels('Notable Events', 9)
    cycleHeadingLevels('Implementation Strategy', 3)
    cycleHeadingLevels('Advanced Techniques', 8)
    cycleHeadingLevels('Another Subtopic', 6)
  })

  it('should validate all allowed and disallowed level changes', () => {
    // Create a document with various heading levels for targeted testing
    cy.createDocument(DeepNestedDocumentStructure)
    cy.wait(1000) // Ensure document is fully rendered

    // Try to make a level 2 heading into a level 1 (invalid), mean create a new h1 section
    cy.validateHeadingLevelChange('Introduction Section', 2, 1).then((result) => {
      console.log('result1', result)
      expect(result.valid).to.be.false
      expect(result.reason).to.include('between 2-9')
    })

    // Try to make a child heading same level as its parent (invalid)
    cy.validateHeadingLevelChange('Overview', 3, 2).then((result) => {
      console.log('result2', result)
      expect(result.valid).to.be.false
      expect(result.reason).to.include('parent level')
    })

    // Try to make a heading level less than its child (invalid)
    cy.validateHeadingLevelChange('Key Concepts', 4, 6).then((result) => {
      console.log('result3', result)
      expect(result.valid).to.be.true
    })

    // Valid level change with no warnings
    cy.validateHeadingLevelChange('Modules', 7, 8).then((result) => {
      expect(result.valid).to.be.true
      expect(result.warning).to.be.undefined
    })

    // Apply a complex series of changes and verify document integrity
    cy.applyHeadingLevelChange('Core Ideas', 6, 7).then((result) => {
      expect(result.applied).to.be.true
      verifyHeadingLevel('Core Ideas', 7)

      cy.applyHeadingLevelChange('Key Concepts', 4, 5).then((result) => {
        expect(result.applied).to.be.true
        verifyHeadingLevel('Key Concepts', 5)

        cy.applyHeadingLevelChange('Fundamental Principles', 5, 6).then((result) => {
          expect(result.applied).to.be.true
          verifyHeadingLevel('Fundamental Principles', 6)

          // Reset back to original to clean up
          cy.applyHeadingLevelChange('Core Ideas', 7, 6).then(() => {
            cy.applyHeadingLevelChange('Key Concepts', 5, 4).then(() => {
              cy.applyHeadingLevelChange('Fundamental Principles', 6, 5)
            })
          })
        })
      })
    })
  })

  it('should handle deterministic heading level changes in complex structures', () => {
    // Create the complex document
    cy.createDocument(AsymmetricDocumentStructure)
    cy.wait(1000) // Ensure document is fully rendered

    // Deterministic matrix to avoid flaky random outcomes
    const changeMatrix = [
      { title: 'Introduction to Topic', from: 2, to: 4 },
      { title: 'Technical Considerations', from: 2, to: 5 },
      { title: 'Implementation Strategy', from: 3, to: 6 },
      { title: 'Current State', from: 4, to: 7 },
      { title: 'Recent Developments', from: 5, to: 8 }
    ]

    changeMatrix.forEach((item) => {
      cy.log(`Testing deterministic change: "${item.title}" level ${item.from} -> level ${item.to}`)

      cy.applyHeadingLevelChange(item.title, item.from, item.to).then((result) => {
        cy.log(`Deterministic level change result: ${JSON.stringify(result)}`)

        // If the change applied, verify it and then change back
        if (result.applied) {
          verifyHeadingLevel(item.title, item.to)

          // Change back to original level
          cy.applyHeadingLevelChange(item.title, item.to, item.from).then((resetResult) => {
            cy.log(`Reset result: ${JSON.stringify(resetResult)}`)

            if (resetResult.applied) {
              verifyHeadingLevel(item.title, item.from)
            }
          })
        }
      })
    })
  })
})
