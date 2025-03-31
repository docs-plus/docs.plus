describe('DOM Structure Validation - Dynamic Modifications', () => {
  beforeEach(() => {
    // Start with a valid document
    cy.visit('/cypress/fixtures/cypress-commands/validateDomStructure/dome-test-1.html')

    // Verify it's initially valid
    cy.validateDomStructure({ throwOnError: false, logResults: false }).then((result) => {
      expect(result.valid).to.equal(true)
      expect(result.errors).to.have.length(0)
    })
  })

  it('detects invalid structure after dynamically nesting a level 1 heading', () => {
    // Modify the DOM to create an invalid structure
    cy.window().then((win) => {
      // Find the first level 2 heading
      const level2Heading = win.document.querySelector('.heading[level="2"]')
      const contentsElement = level2Heading.querySelector('.contents')

      // Create a new invalid level 1 heading
      const newHeadingElement = win.document.createElement('div')
      newHeadingElement.className = 'heading opend'
      newHeadingElement.setAttribute('level', '1')
      newHeadingElement.setAttribute('data-type', 'heading')
      newHeadingElement.setAttribute('data-id', 'dynamic-test-id-1')

      // Create inner structure
      newHeadingElement.innerHTML = `
        <div class="wrapBlock" data-id="dynamic-test-id-1">
          <h1 class="title" level="1"><span>Dynamically Added Heading</span></h1>
          <div class="contentWrapper opend" data-type="contentWrapper">
            <div class="contents">
              <p>This heading was dynamically added to create an invalid structure.</p>
            </div>
          </div>
        </div>
      `

      // Add it as a child of the level 2 heading (which is invalid)
      contentsElement.appendChild(newHeadingElement)
    })

    // Now validate - should fail
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.equal(false)

      // Check that the specific error about nested level 1 heading is detected
      const nestedSectionError = result.errors.some(
        (error) =>
          error.includes('Section (level 1) cannot be nested inside another heading') &&
          error.includes('Dynamically Added Heading')
      )

      expect(nestedSectionError).to.be.true
    })
  })

  it('detects invalid heading hierarchy after dynamic modification', () => {
    // Modify the DOM to create a heading hierarchy violation
    cy.window().then((win) => {
      // Find a level 3 heading
      const level3Heading = win.document.querySelector('.heading[level="3"]')
      const contentsElement = level3Heading.querySelector('.contents')

      // Create a new invalid level 2 heading (lower level than parent)
      const newHeadingElement = win.document.createElement('div')
      newHeadingElement.className = 'heading opend'
      newHeadingElement.setAttribute('level', '2')
      newHeadingElement.setAttribute('data-type', 'heading')
      newHeadingElement.setAttribute('data-id', 'dynamic-test-id-2')

      // Create inner structure
      newHeadingElement.innerHTML = `
        <div class="wrapBlock" data-id="dynamic-test-id-2">
          <h2 class="title" level="2"><span>Invalid Level 2 Inside Level 3</span></h2>
          <div class="contentWrapper opend" data-type="contentWrapper">
            <div class="contents">
              <p>This heading violates the heading hierarchy rules.</p>
            </div>
          </div>
        </div>
      `

      // Add it as a child of the level 3 heading (which is invalid since 2 < 3)
      contentsElement.appendChild(newHeadingElement)
    })

    // Now validate - should fail
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.equal(false)

      // Check for hierarchy violation error
      const hierarchyError = result.errors.some(
        (error) =>
          error.includes('Heading hierarchy violated') &&
          error.includes('Level 2 heading') &&
          error.includes('level 3') &&
          error.includes('Invalid Level 2 Inside Level 3')
      )

      expect(hierarchyError).to.be.true
    })
  })

  it('detects invalid heading level after dynamic modification', () => {
    // Modify the DOM to create an invalid heading level
    cy.window().then((win) => {
      // Find the first level 1 heading
      const level1Heading = win.document.querySelector('.heading[level="1"]')
      const contentsElement = level1Heading.querySelector('.contents')

      // Create a new heading with invalid level
      const newHeadingElement = win.document.createElement('div')
      newHeadingElement.className = 'heading opend'
      newHeadingElement.setAttribute('level', '15') // Invalid level (outside 1-10 range)
      newHeadingElement.setAttribute('data-type', 'heading')
      newHeadingElement.setAttribute('data-id', 'dynamic-test-id-3')

      // Create inner structure
      newHeadingElement.innerHTML = `
        <div class="wrapBlock" data-id="dynamic-test-id-3">
          <h6 class="title" level="15"><span>Invalid Level 15 Heading</span></h6>
          <div class="contentWrapper opend" data-type="contentWrapper">
            <div class="contents">
              <p>This heading has an invalid level (15).</p>
            </div>
          </div>
        </div>
      `

      // Add it to the document
      contentsElement.appendChild(newHeadingElement)
    })

    // Now validate - should fail
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.equal(false)

      // Check for invalid level error
      const levelError = result.errors.some(
        (error) =>
          error.includes('Heading level must be between 1 and 10') &&
          error.includes('found 15') &&
          error.includes('Invalid Level 15 Heading')
      )

      expect(levelError).to.be.true
    })
  })

  it('validates structure after fixing dynamic modifications', () => {
    // First make an invalid modification
    cy.window().then((win) => {
      // Find a heading
      const heading = win.document.querySelector('.heading[level="4"]')

      // Change its level to invalid value
      heading.setAttribute('level', '11')
      const titleEl = heading.querySelector('.title')
      titleEl.setAttribute('level', '11')
      titleEl.textContent = 'Invalid Level Changed to 11'
    })

    // Verify it's now invalid
    cy.validateDomStructure({ throwOnError: false, logResults: false }).then((result) => {
      expect(result.valid).to.equal(false)

      // Now fix the problem
      cy.window().then((win) => {
        const heading = win.document.querySelector('.heading[level="11"]')
        // Change back to valid level
        heading.setAttribute('level', '4')
        const titleEl = heading.querySelector('.title')
        titleEl.setAttribute('level', '4')
        titleEl.textContent = 'Fixed Level Back to 4'
      })

      // Validate again - should be fixed now
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((fixedResult) => {
        expect(fixedResult.valid).to.equal(true)
        expect(fixedResult.errors).to.have.length(0)
      })
    })
  })

  it('verifies all validation rules with multiple simultaneous errors', () => {
    // Make multiple modifications to create several types of errors at once
    cy.window().then((win) => {
      // 1. Add an invalid nested level 1 heading
      const level2Heading = win.document.querySelector('.heading[level="2"]')
      level2Heading.querySelector('.contents').innerHTML += `
        <div class="heading opend" level="1" data-type="heading" data-id="multi-error-1">
          <div class="wrapBlock" data-id="multi-error-1">
            <h1 class="title" level="1"><span>Invalid Nested Section</span></h1>
            <div class="contentWrapper opend" data-type="contentWrapper">
              <div class="contents">
                <p>Invalid nested level 1 heading.</p>
              </div>
            </div>
          </div>
        </div>
      `

      // 2. Add a heading with invalid level
      const level1Heading = win.document.querySelector('.heading[level="1"]')
      level1Heading.querySelector('.contents').innerHTML += `
        <div class="heading opend" level="12" data-type="heading" data-id="multi-error-2">
          <div class="wrapBlock" data-id="multi-error-2">
            <h6 class="title" level="12"><span>Invalid Level 12 Heading</span></h6>
            <div class="contentWrapper opend" data-type="contentWrapper">
              <div class="contents">
                <p>Invalid level 12 heading.</p>
              </div>
            </div>
          </div>
        </div>
      `

      // 3. Add a hierarchy violation
      const level4Heading = win.document.querySelector('.heading[level="4"]')
      level4Heading.querySelector('.contents').innerHTML += `
        <div class="heading opend" level="3" data-type="heading" data-id="multi-error-3">
          <div class="wrapBlock" data-id="multi-error-3">
            <h3 class="title" level="3"><span>Invalid Hierarchy Level 3</span></h3>
            <div class="contentWrapper opend" data-type="contentWrapper">
              <div class="contents">
                <p>Invalid hierarchy - level 3 inside level 4.</p>
              </div>
            </div>
          </div>
        </div>
      `
    })

    // Now validate - should have multiple errors
    cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
      expect(result.valid).to.equal(false)

      // At least one error of each type
      const nestingError = result.errors.some((e) =>
        e.includes('Section (level 1) cannot be nested')
      )
      const levelError = result.errors.some((e) => e.includes('found 12'))
      const hierarchyError = result.errors.some(
        (e) => e.includes('Level 3 heading') && e.includes('level 4')
      )

      expect(nestingError).to.be.true
      expect(levelError).to.be.true
      expect(hierarchyError).to.be.true

      // Should have at least 3 errors (one for each type)
      expect(result.errors.length).to.be.at.least(3)
    })
  })
})
