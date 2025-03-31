describe('DOM Structure Validation - Invalid Structure', () => {
  beforeEach(() => {
    // Load the invalid test fixture
    cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-invalid.html')
  })

  it('detects level 1 headings nested inside another heading', () => {
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      // Validation should fail
      expect(result.valid).to.equal(false)

      // Check if a level 1 heading nested inside another heading is detected
      const level1Errors = result.errors.filter((error) =>
        error.includes('Section (level 1) cannot be nested inside another heading')
      )

      expect(level1Errors).to.have.length.at.least(1)
    })
  })

  it('detects heading hierarchy violations', () => {
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      // Check if heading hierarchy violations are detected
      const hierarchyErrors = result.errors.filter((error) =>
        error.includes('Heading hierarchy violated')
      )

      expect(hierarchyErrors).to.have.length.at.least(1)
    })
  })

  it('detects headings with levels outside valid range', () => {
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      // Check if headings with levels outside valid range are detected
      const rangeErrors = result.errors.filter((error) =>
        error.includes('Heading level must be between 1 and 10')
      )

      expect(rangeErrors).to.have.length.at.least(1)
    })
  })

  it('provides details about all validation errors', () => {
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      // Should detect all types of errors
      expect(result.errors).to.have.length.at.least(3)

      // Log all errors for debugging
      cy.log(`Found ${result.errors.length} validation errors:`)
      result.errors.forEach((error, index) => {
        cy.log(`${index + 1}. ${error}`)
      })

      // Verify the structure representation is built
      expect(result.structure).to.have.length.greaterThan(0)
    })
  })
})
