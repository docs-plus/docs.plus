/* eslint-disable no-undef */
import { TEST_TITLE, TEST_CONTENT } from '../../../support/commands'
import { section, paragraph, heading } from '../../../fixtures/docMaker'

const DocumentStructureSchema = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction and Overview', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Key Concepts', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Implementation Details', [
        paragraph(TEST_CONTENT.short),
        heading(6, 'Advanced Configuration', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

// describe('Caret Position on Change', () => {
//   beforeEach(() => {
//     cy.visitEditor({ persist: true, docName: 'caret-position-on-change-doc' })
//     cy.createDocument(DocumentStructureSchema)
//     cy.wait(500) // Allow time for document to fully render
//   })

//   it('should position caret at the end of heading after changing heading level', () => {
//     // Get the initial text and length before changing level
//     cy.window().then((win) => {
//       const editor = win._editor

//       // Find the heading node for "Introduction and Overview"
//       let headingText = 'Introduction and Overview'
//       let headingPos = null
//       let headingNode = null
//       let headingLength = 0

//       editor.state.doc.descendants((node, pos) => {
//         if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
//           headingNode = node
//           headingPos = pos
//           headingLength = node.textContent.length
//           return false // Stop traversal
//         }
//       })

//       // Store heading information for later verification
//       cy.wrap(headingLength).as('headingLength')
//     })

//     // Change heading level from 2 to 3
//     cy.putPosCaretInHeading(2, 'Introduction and Overview', 'start')
//       .realPress(['Alt', 'Meta', '3'])
//       .wait(100) // Wait for update

//     // Verify caret position is at the end of the heading after level change
//     cy.window().then((win) => {
//       const editor = win._editor
//       const selection = editor.state.selection
//       const headingText = 'Introduction and Overview'

//       // Get the new heading node position after level change
//       let newHeadingNode = null
//       let newHeadingPos = null

//       editor.state.doc.descendants((node, pos) => {
//         if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
//           newHeadingNode = node
//           newHeadingPos = pos
//           return false
//         }
//       })

//       // Get heading end position
//       const headingEndPos = newHeadingPos + newHeadingNode.nodeSize - 1

//       // Verify the current selection position is at the end of the heading
//       expect(selection.from).to.equal(headingEndPos)
//       expect(selection.to).to.equal(headingEndPos)

//       // Verify heading level changed to 3
//       expect(newHeadingNode.attrs.level).to.equal(3)
//     })
//   })

//   it('should position caret at the end of heading after multiple level changes', () => {
//     // Change heading level from 2 to 4 for "Implementation Details"
//     cy.putPosCaretInHeading(2, 'Implementation Details', 'start')
//       .realPress(['Alt', 'Meta', '4'])
//       .wait(100)

//     // Verify caret position
//     cy.window().then((win) => {
//       const editor = win._editor
//       const selection = editor.state.selection
//       const headingText = 'Implementation Details'

//       // Find the heading after change
//       let headingNode = null
//       let headingPos = null

//       editor.state.doc.descendants((node, pos) => {
//         if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
//           headingNode = node
//           headingPos = pos
//           return false
//         }
//       })

//       // Calculate end position
//       const headingEndPos = headingPos + headingNode.nodeSize - 1

//       // Verify selection at end
//       expect(selection.from).to.equal(headingEndPos)
//       expect(selection.to).to.equal(headingEndPos)
//       expect(headingNode.attrs.level).to.equal(4)
//     })

//     // Change heading level again from 4 to 3
//     cy.realPress(['Alt', 'Meta', '3']).wait(100)

//     // Verify caret position again
//     cy.window().then((win) => {
//       const editor = win._editor
//       const selection = editor.state.selection
//       const headingText = 'Implementation Details'

//       let headingNode = null
//       let headingPos = null

//       editor.state.doc.descendants((node, pos) => {
//         if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
//           headingNode = node
//           headingPos = pos
//           return false
//         }
//       })

//       const headingEndPos = headingPos + headingNode.nodeSize - 1

//       expect(selection.from).to.equal(headingEndPos)
//       expect(selection.to).to.equal(headingEndPos)
//       expect(headingNode.attrs.level).to.equal(3)
//     })
//   })

//   it('should position caret at the end of heading when changing nested headings', () => {
//     // Change nested heading level from 4 to 3 for "Key Concepts"
//     cy.putPosCaretInHeading(4, 'Key Concepts', 'start').realPress(['Alt', 'Meta', '3']).wait(100)

//     // Verify caret position
//     cy.window().then((win) => {
//       const editor = win._editor
//       const selection = editor.state.selection
//       const headingText = 'Key Concepts'

//       let headingNode = null
//       let headingPos = null

//       editor.state.doc.descendants((node, pos) => {
//         if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
//           headingNode = node
//           headingPos = pos
//           return false
//         }
//       })

//       const headingEndPos = headingPos + headingNode.nodeSize - 1

//       expect(selection.from).to.equal(headingEndPos)
//       expect(selection.to).to.equal(headingEndPos)
//       expect(headingNode.attrs.level).to.equal(3)
//     })
//   })

//   it('should position caret at the end of heading when changing deeply nested headings', () => {
//     // Change deeply nested heading from 6 to 4 for "Advanced Configuration"
//     cy.putPosCaretInHeading(6, 'Advanced Configuration', 'start')
//       .realPress(['Alt', 'Meta', '4'])
//       .wait(100)

//     // Verify caret position
//     cy.window().then((win) => {
//       const editor = win._editor
//       const selection = editor.state.selection
//       const headingText = 'Advanced Configuration'

//       let headingNode = null
//       let headingPos = null

//       editor.state.doc.descendants((node, pos) => {
//         if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
//           headingNode = node
//           headingPos = pos
//           return false
//         }
//       })

//       const headingEndPos = headingPos + headingNode.nodeSize - 1

//       expect(selection.from).to.equal(headingEndPos)
//       expect(selection.to).to.equal(headingEndPos)
//       expect(headingNode.attrs.level).to.equal(4)
//     })
//   })
// })

describe('Complex Nested Heading Level Changes', () => {
  const ComplexDocumentStructure = {
    documentName: TEST_TITLE.HelloDocy,
    sections: [
      section('Main Document Section', [
        paragraph(TEST_CONTENT.short),
        heading(2, 'Project Overview', [
          paragraph(TEST_CONTENT.short),
          heading(3, 'Architecture', [
            paragraph(TEST_CONTENT.short),
            heading(4, 'Backend Services', [
              paragraph(TEST_CONTENT.short),
              heading(5, 'Database Layer', [
                paragraph(TEST_CONTENT.short),
                heading(6, 'Sharding Strategy', [
                  paragraph(TEST_CONTENT.short),
                  heading(7, 'Partition Keys', [paragraph(TEST_CONTENT.short)])
                ]),
                heading(6, 'Replication Setup', [paragraph(TEST_CONTENT.short)])
              ])
            ])
          ]),
          heading(3, 'Frontend Components', [
            paragraph(TEST_CONTENT.short),
            heading(6, 'AJAX Framework', [
              paragraph(TEST_CONTENT.short),
              heading(7, 'XHR Framework', [paragraph(TEST_CONTENT.short)])
            ]),
            heading(5, 'UX Framework', [paragraph(TEST_CONTENT.short)]),
            heading(4, 'UI Framework', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ]),
      section('Second Section', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'First Section Heading', [paragraph(TEST_CONTENT.short)]),
        heading(2, 'Second Section Heading', [paragraph(TEST_CONTENT.short)])
      ])
    ]
  }

  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'complex-heading-changes-doc' })
    cy.createDocument(ComplexDocumentStructure)
    cy.wait(500)
  })

  it('should maintain correct caret position during rapid heading level changes in deeply nested structure', () => {
    const verifyCaretPosition = (headingText, expectedLevel) => {
      cy.window().then((win) => {
        const editor = win._editor
        const selection = editor.state.selection

        let headingNode = null
        let headingPos = null

        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'contentHeading' && node.textContent.includes(headingText)) {
            headingNode = node
            headingPos = pos
            return false
          }
        })

        const headingEndPos = headingPos + headingNode.nodeSize - 1

        // Verify caret position and heading level
        expect(selection.from).to.equal(headingEndPos)
        expect(selection.to).to.equal(headingEndPos)
        expect(headingNode.attrs.level).to.equal(expectedLevel)
      })
    }

    // Start with deeply nested heading "Sharding Strategy" (level 6)
    cy.putPosCaretInHeading(6, 'Sharding Strategy', 'start')

    // Rapid changes: 6 -> 2 -> 8 -> 4 -> 1 -> 6
    // Change to level 2
    cy.realPress(['Alt', 'Meta', '2']).wait(100)
    verifyCaretPosition('Sharding Strategy', 2)

    // Change to level 8
    cy.realPress(['Alt', 'Meta', '8']).wait(100)
    verifyCaretPosition('Sharding Strategy', 8)

    // Change to level 4
    cy.realPress(['Alt', 'Meta', '4']).wait(100)
    verifyCaretPosition('Sharding Strategy', 4)

    // Change to level 1
    cy.realPress(['Alt', 'Meta', '1']).wait(100)
    verifyCaretPosition('Sharding Strategy', 1)

    // Change to level 6
    cy.realPress(['Alt', 'Meta', '6']).wait(100)
    verifyCaretPosition('Sharding Strategy', 6)
  })

  it('should handle caret position correctly when changing sibling heading levels', () => {
    // Test with sibling headings "Sharding Strategy" and "Replication Setup"
    cy.putPosCaretInHeading(6, 'Sharding Strategy', 2).realPress(['Alt', 'Meta', '7']).wait(100)

    cy.window().then((win) => {
      const editor = win._editor
      const selection = editor.state.selection

      let headingNode = null
      let headingPos = null
      let siblingNode = null
      let siblingPos = null

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'contentHeading') {
          if (node.textContent.includes('Sharding Strategy')) {
            headingNode = node
            headingPos = pos
          } else if (node.textContent.includes('Replication Setup')) {
            siblingNode = node
            siblingPos = pos
          }
        }
      })

      const headingEndPos = headingPos + headingNode.nodeSize - 1

      // Verify first heading
      expect(selection.from).to.equal(headingEndPos)
      expect(selection.to).to.equal(headingEndPos)
      expect(headingNode.attrs.level).to.equal(7)

      // Verify sibling heading level remained unchanged
      expect(siblingNode.attrs.level).to.equal(6)
    })
  })

  it('should maintain caret position when changing heading levels across multiple parent levels', () => {
    // Start with "Partition Keys" (level 7) and move it drastically through the hierarchy
    cy.putPosCaretInHeading(7, 'Partition Keys', -3)

    // Series of changes crossing multiple parent levels
    const levelChanges = [3, 8, 2, 6]

    levelChanges.forEach((level) => {
      cy.realPress(['Alt', 'Meta', String(level)])
        .wait(100)
        .window()
        .then((win) => {
          const editor = win._editor
          const selection = editor.state.selection
          let headingNode = null
          let headingPos = null

          editor.state.doc.descendants((node, pos) => {
            if (
              node.type.name === 'contentHeading' &&
              node.textContent.includes('Partition Keys')
            ) {
              headingNode = node
              headingPos = pos
              return false
            }
          })

          const headingEndPos = headingPos + headingNode.nodeSize - 1

          expect(selection.from).to.equal(headingEndPos)
          expect(selection.to).to.equal(headingEndPos)
          expect(headingNode.attrs.level).to.equal(level)
        })
    })
  })
})
