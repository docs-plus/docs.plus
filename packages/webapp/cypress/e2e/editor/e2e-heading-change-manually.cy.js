/* eslint-disable no-undef */
import { TEST_TITLE, TEST_CONTENT } from '../../support/commands'
import { section, paragraph, heading } from '../../fixtures/docMaker'

const DocumentStructureSchema1 = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Introduction and Overview', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Key Concepts', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Implementation Details', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Advanced Configuration', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Main Document Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Intro and Lab', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Key Concepts 2', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Key features part 1', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

const DocumentStructureSchema2 = {
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

describe('Heading Change Manually', { testIsolation: false }, () => {
  before(() => {
    cy.visitEditor({ persist: true, docName: 'heading-change-manually-doc' })
  })

  // create a simple document with a heading and a paragraph
  it('should create a simple document with a heading and a paragraph', () => {
    cy.createDocument(DocumentStructureSchema1)
  })

  it('should update the heading at position', () => {
    // Wait for document to fully load before attempting to manipulate headings
    cy.wait(500) // Give time for the document to fully render

    cy.putPosCaretInHeading(2, 'Introduction', 'end')
      .type(' Hello World')
      .should('contain', 'Hello World')

    // Test different positions
    cy.putPosCaretInHeading(2, 'Implementation', 'start')
      .type('Updated: ')
      .should('contain', 'Updated:')

    cy.putPosCaretInHeading(2, 'Intro and Lab', 'start')
      .type('Updated: -->')
      .should('contain', 'Updated:')

    cy.putPosCaretInHeading(3, 'Key Concepts 2', 3)
      .type(' -Features-')
      .should('contain', 'Key -Features')

    cy.putPosCaretInHeading(3, 'Key features part 1', -2)
      .type('end of part 2')
      .should('contain', 'end of part 21')
  })

  // change the heading level
  it('should change the heading level', () => {
    // Make sure document is fully rendered before proceeding
    cy.wait(1000)

    cy.log('Starting heading level change test')

    // Use the applyHeadingLevelChange command to validate and apply the change in one step
    cy.applyHeadingLevelChange('Introduction and Overview', 2, 4).then((result) => {
      expect(result.applied).to.be.true
      cy.log(`Changed heading from level ${result.previousLevel} to ${result.newLevel}`)

      if (result.warnings) {
        cy.log(`Warning: ${result.warnings}`)
      }
    })

    // check the Introduction heading is level 4
    cy.get('.heading')
      .contains('Introduction')
      .closest('.heading')
      .should('have.attr', 'level', '4')
  })

  it('should validate different heading level change scenarios', () => {
    // Wait to ensure document is fully loaded

    // Create document with more complex structure
    cy.createDocument(DocumentStructureSchema2)

    // Scenario 1: Try to change a heading to a level less than 2 (invalid)
    cy.validateHeadingLevelChange('Introduction and Overview', 2, 1).then((result) => {
      expect(result.valid).to.be.false
      expect(result.reason).to.include('must be between 2-9')
    })

    // Scenario 2: Try to change a heading to a level greater than its child
    cy.validateHeadingLevelChange('Introduction and Overview', 2, 5).then((result) => {
      expect(result.valid).to.be.true
      expect(result.warning).to.include('inconsistent with its')
    })

    // Scenario 3: Valid level change that creates warning about siblings
    cy.validateHeadingLevelChange('Implementation Details', 2, 3).then((result) => {
      expect(result.valid).to.be.true
      expect(result.warning).to.include('inconsistent with its')
    })

    // Scenario 4: Valid level change with no warnings
    cy.validateHeadingLevelChange('Key Concepts', 4, 3).then((result) => {
      expect(result.valid).to.be.true
      expect(result.warning).to.be.undefined

      // Actually perform the change after validation
      if (result.valid) {
        cy.putPosCaretInHeading(4, 'Key Concepts', 'start').realPress(['Alt', 'Meta', '3'])

        // Verify the change was made
        cy.get('.heading')
          .contains('Key Concepts')
          .closest('.heading')
          .should('have.attr', 'level', '3')
      }
    })

    // Scenario 5: Try to change a child heading to same level as parent (invalid)
    cy.validateHeadingLevelChange('Advanced Configuration', 6, 2).then((result) => {
      expect(result.valid).to.be.false
      expect(result.reason).to.include('must be greater than parent level')
    })
  })

  it('should handle heading level changes with applyHeadingLevelChange command', () => {
    // Create fresh document
    cy.createDocument(DocumentStructureSchema1)

    // Scenario 1: Apply a valid change
    cy.applyHeadingLevelChange('Key Concepts', 3, 5).then((result) => {
      expect(result.applied).to.be.true
      expect(result.previousLevel).to.equal(3)
      expect(result.newLevel).to.equal(5)
    })

    // Scenario 2: Try to apply an invalid change (should not apply by default)
    cy.applyHeadingLevelChange('Implementation Details', 2, 1).then((result) => {
      expect(result.applied).to.be.false
      expect(result.reason).to.include('must be between 2-9')
    })

    // Scenario 3: Try to apply a change that would violate parent-child relationship (invalid)
    cy.applyHeadingLevelChange('Advanced Configuration', 4, 3).then((result) => {
      expect(result.applied).to.be.true
      // manually check the heading level
      cy.get('.heading')
        .contains('Advanced Configuration')
        .closest('.heading')
        .should('have.attr', 'level', '3')
    })

    // Scenario 4: Apply a change that has warnings about siblings
    cy.applyHeadingLevelChange('Key features part 1', 3, 4).then((result) => {
      expect(result.applied).to.be.true
      expect(result.warnings).to.include('inconsistent with its') // should have warning about siblings
    })
  })
})
