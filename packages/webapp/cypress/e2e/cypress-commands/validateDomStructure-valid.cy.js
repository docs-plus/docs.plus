describe('DOM Structure Validation - Valid Structure', () => {
  it('validates dome-test-1.html structure', () => {
    // Load the test fixture
    cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-1.html')

    // Validate the structure - should pass
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      // Validation should pass
      expect(result.valid).to.equal(true)
      expect(result.errors).to.have.length(0)

      // Verify the structure is built correctly
      expect(result.structure).to.have.length.greaterThan(0)

      // Check that we have top level sections
      const topLevelSections = result.structure.filter(
        (item) =>
          (item.level === 1 && !item.path.includes('heading')) || item.path.split('>').length === 2 // Only one level deep from root
      )
      expect(topLevelSections).to.have.length.at.least(1)
    })
  })

  it('validates dome-test-2.html structure with skipped heading levels', () => {
    // Load the second test fixture which has level jumps (like level 3 to level 5)
    cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-2.html')

    // Validate the structure - should pass despite level jumps (which are allowed)
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      // Validation should pass
      expect(result.valid).to.equal(true)
      expect(result.errors).to.have.length(0)

      // Verify the structure representation
      expect(result.structure).to.have.length.greaterThan(0)

      // Verify we have a heading with level jump (find a parent with level 3 that has a child with level 5)
      const hasLevelJump = result.structure.some(
        (item) =>
          item.path.includes('level=3') &&
          item.children &&
          item.children.some((child) => child.level === 5)
      )

      // If structure doesn't include children, we can just check that level 3 and level 5 headings exist
      const hasLevel3 = result.structure.some((item) => item.level === 3)
      const hasLevel5 = result.structure.some((item) => item.level === 5)

      // Either condition is acceptable depending on how structure is built
      expect(hasLevelJump || (hasLevel3 && hasLevel5)).to.be.true
    })
  })

  it('compares structure between dome-test-1 and dome-test-2', () => {
    // First load test-1 and capture structure
    cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-1.html')
    let structure1

    cy.validateDomStructure({ throwOnError: false, logResults: false })
      .then((result1) => {
        structure1 = result1.structure
        expect(result1.valid).to.be.true

        // Now load test-2 and compare
        cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-2.html')

        return cy.validateDomStructure({ throwOnError: false, logResults: false })
      })
      .then((result2) => {
        expect(result2.valid).to.be.true

        // Compare certain aspects of the structures
        // They should be different but both valid
        expect(result2.structure.length).not.to.equal(structure1.length)

        // Calculate heading level distributions as a fingerprint
        const levels1 = calculateHeadingLevels(structure1)
        const levels2 = calculateHeadingLevels(result2.structure)

        // The heading level distributions should be different
        expect(JSON.stringify(levels1)).not.to.equal(JSON.stringify(levels2))

        // Log the differences for reference
        cy.log('Heading levels in dome-test-1:', JSON.stringify(levels1))
        cy.log('Heading levels in dome-test-2:', JSON.stringify(levels2))
      })
  })

  it('validates nested content and HTML elements within headings', () => {
    cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-1.html')

    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.be.true

      // Verify that headings with nested content including lists and code blocks are valid
      cy.get('.heading').should('exist')
      cy.get('.codeBlock').should('exist')
      cy.get('ol').should('exist')
      cy.get('ul').should('exist')

      // Check if the DOM contains the expected number of elements
      cy.get('.heading[level="1"]').should('have.length.at.least', 2)
      cy.get('.heading[level="2"]').should('have.length.at.least', 2)
      cy.get('.heading[level="3"]').should('have.length.at.least', 1)
      cy.get('.heading[level="4"]').should('have.length.at.least', 1)
      cy.get('.heading[level="8"]').should('have.length.at.least', 1)
    })
  })
})

// Helper function to count heading levels
function calculateHeadingLevels(structure) {
  const levels = {}

  structure.forEach((item) => {
    const level = item.level
    levels[level] = (levels[level] || 0) + 1
  })

  return levels
}
