/**
 * Helper functions for testing document structure
 */

/**
 * Generates tests for verifying a document structure
 * @param {Object} documentStructure - The document structure to verify
 * @param {Object} options - Options for test generation
 * @param {boolean} options.screenshot - Whether to take a screenshot after all tests (default: false)
 */
export function generateDocumentTests(documentStructure, options = {}) {
  // Set default options
  const defaultOptions = {
    screenshot: false
  }

  // Merge provided options with defaults
  const opts = { ...defaultOptions, ...options }
  console.log('opts', opts)

  // We'll still do basic validation first to prevent starting tests with invalid structure
  const validationResult = validateDocumentStructure(documentStructure)
  if (!validationResult.valid) {
    throw new Error(`Invalid document structure: ${validationResult.error}`)
  }

  describe(`Document: "${documentStructure.documentName}"`, { testIsolation: false }, () => {
    before(() => {
      cy.viewport(1280, 600)
      cy.visit('http://localhost:3000/editor')
      cy.get('.docy_editor > .tiptap.ProseMirror').should('be.visible')
    })

    // Only add the screenshot hook if screenshot is true
    if (opts.screenshot) {
      after(function () {
        // Use the document name for the filename
        const specName = Cypress.spec.name
          .replace('.cy.js', '')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()

        // Take a screenshot of the full page (including scrollable area)
        cy.screenshot(
          `${specName}/${documentStructure.documentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}/final_result`,
          {
            capture: 'fullPage', // Use fullPage to capture the entire scrollable area
            overwrite: true
          }
        )
      })
    }

    // Add a dedicated test for document structure validation with detailed output
    describe('Document structure validation', () => {
      it('Validates document structure and heading hierarchy', () => {
        // Use the custom command for validation
        cy.validateDocumentStructure(documentStructure, { throwOnError: false })
          .should('have.property', 'valid', true)
          .then((result) => {
            // Get a detailed report to display in the test results
            const report = validateDocumentWithReport(documentStructure, { verbose: true })

            // Log the structure details
            Cypress.log({
              name: 'docStructure',
              displayName: '📄 Structure',
              message: report.details,
              consoleProps: () => ({
                'Document Name': report.documentName,
                'Section Count': report.sectionCount,
                'Heading Counts': report.headingCounts,
                Validation: report.isValid ? 'Valid' : report.error,
                'Heading Structure': report.headingStructure,
                'Full Document Structure': documentStructure
              })
            })
          })
      })
    })

    it('Create document', () => {
      cy.createDocument(documentStructure)
    })

    it('Verify heading counts', () => {
      // Analyze document structure to get heading counts by level
      const headingCounts = analyzeHeadingCounts(documentStructure)

      // Verify section (level 1) count
      cy.get('.docy_editor .heading[level="1"]').should(
        'have.length',
        documentStructure.sections.length
      )

      // Verify all other heading levels that exist in the document
      Object.entries(headingCounts).forEach(([level, count]) => {
        if (level !== '1' && count > 0) {
          cy.get(`.docy_editor .heading[level="${level}"]`).should('have.length', count)
        }
      })
    })

    // Generate tests for each section
    documentStructure.sections.forEach((section, sectionIndex) => {
      describe(`Section ${sectionIndex + 1}: "${section.title}"`, () => {
        beforeEach(() => {
          cy.get('.docy_editor > .tiptap.ProseMirror').should('be.visible')
        })

        it(`Verify title and paragraphs`, () => {
          // Verify title
          cy.get('.docy_editor .heading[level="1"]')
            .eq(sectionIndex)
            .find('.title')
            .should('contain.text', section.title)

          // Find paragraphs directly in the section
          const directParagraphs = section.contents.filter(
            (content) => content.type === 'paragraph'
          )

          // Verify paragraphs if they exist
          if (directParagraphs.length > 0) {
            directParagraphs.forEach((para, paraIndex) => {
              cy.get('.docy_editor .heading[level="1"]')
                .eq(sectionIndex)
                .find('.contents > p')
                .eq(paraIndex)
                .should('contain.text', para.content)
            })
          }
        })

        // Test ordered lists if they exist
        const orderedLists = section.contents.filter((content) => content.type === 'orderedList')

        if (orderedLists.length > 0) {
          orderedLists.forEach((list, listIndex) => {
            it(`Verify ordered list #${listIndex + 1} (${list.content.length} items)`, () => {
              cy.get('.docy_editor .heading[level="1"]')
                .eq(sectionIndex)
                .find('ol')
                .eq(listIndex)
                .within(() => {
                  cy.get('li').should('have.length', list.content.length)

                  list.content.forEach((item, itemIndex) => {
                    cy.get('li').eq(itemIndex).should('contain.text', item.text)

                    // We don't check for indentation attributes or classes as per original approach
                  })
                })
            })
          })
        }

        // Test bullet lists if they exist
        const bulletLists = section.contents.filter((content) => content.type === 'bulletList')

        if (bulletLists.length > 0) {
          bulletLists.forEach((list, listIndex) => {
            it(`Verify bullet list #${listIndex + 1} (${list.content.length} items)`, () => {
              cy.get('.docy_editor .heading[level="1"]')
                .eq(sectionIndex)
                .find('ul')
                .eq(listIndex)
                .within(() => {
                  cy.get('li').should('have.length', list.content.length)

                  list.content.forEach((item, itemIndex) => {
                    cy.get('li').eq(itemIndex).should('contain.text', item.text)

                    // We don't check for indentation attributes or classes as per original approach
                  })
                })
            })
          })
        }

        // Generate tests for sub-headings in this section
        generateHeadingTests(
          `.docy_editor .heading[level="1"]:eq(${sectionIndex})`,
          section.contents,
          section.title
        )
      })
    })

    // validate dom structure
    it('Validate dom structure', () => {
      cy.validateDomStructure()
    })
  })
}

/**
 * Recursively generates tests for headings within a parent element
 * @param {string} parentSelector - CSS selector for the parent element
 * @param {Array} contents - Array of content objects
 * @param {string} parentTitle - Title of the parent section or heading
 */
function generateHeadingTests(parentSelector, contents, parentTitle) {
  // Find all headings in the contents
  const headings = contents.filter((content) => content.type === 'heading')

  // Skip if no headings found
  if (headings.length === 0) return

  // Group headings by level for organized testing
  const headingsByLevel = {}

  headings.forEach((heading) => {
    if (!headingsByLevel[heading.level]) {
      headingsByLevel[heading.level] = []
    }
    headingsByLevel[heading.level].push(heading)
  })

  // Generate tests for each heading level
  Object.entries(headingsByLevel).forEach(([level, levelHeadings]) => {
    describe(`H${level} in "${parentTitle}" (${levelHeadings.length})`, () => {
      it(`Count H${level} headings`, () => {
        cy.get(parentSelector)
          .find(`.heading[level="${level}"]`)
          .should('have.length', levelHeadings.length)
      })

      // Test each heading at this level
      levelHeadings.forEach((heading, headingIndex) => {
        describe(`H${level}: "${heading.title}"`, () => {
          it(`Verify title and paragraphs`, () => {
            // Verify title
            cy.get(parentSelector)
              .find(`.heading[level="${level}"]:eq(${headingIndex})`)
              .find('.title')
              .should('contain.text', heading.title)

            // Find paragraphs directly in the heading
            const paragraphs = heading.contents.filter((content) => content.type === 'paragraph')

            // Verify paragraphs if they exist
            if (paragraphs.length > 0) {
              paragraphs.forEach((para, paraIndex) => {
                cy.get(parentSelector)
                  .find(`.heading[level="${level}"]:eq(${headingIndex})`)
                  .find('.contents > p')
                  .eq(paraIndex)
                  .should('contain.text', para.content)
              })
            }
          })

          // Test ordered lists if they exist within this heading
          const orderedLists = heading.contents.filter((content) => content.type === 'orderedList')

          if (orderedLists.length > 0) {
            orderedLists.forEach((list, listIndex) => {
              it(`Verify ordered list #${listIndex + 1} (${list.content.length} items)`, () => {
                cy.get(parentSelector)
                  .find(`.heading[level="${level}"]:eq(${headingIndex})`)
                  .find('ol')
                  .eq(listIndex)
                  .within(() => {
                    cy.get('li').should('have.length', list.content.length)

                    list.content.forEach((item, itemIndex) => {
                      cy.get('li').eq(itemIndex).should('contain.text', item.text)

                      // We don't check for indentation attributes or classes as per original approach
                    })
                  })
              })
            })
          }

          // Test bullet lists if they exist within this heading
          const bulletLists = heading.contents.filter((content) => content.type === 'bulletList')

          if (bulletLists.length > 0) {
            bulletLists.forEach((list, listIndex) => {
              it(`Verify bullet list #${listIndex + 1} (${list.content.length} items)`, () => {
                cy.get(parentSelector)
                  .find(`.heading[level="${level}"]:eq(${headingIndex})`)
                  .find('ul')
                  .eq(listIndex)
                  .within(() => {
                    cy.get('li').should('have.length', list.content.length)

                    list.content.forEach((item, itemIndex) => {
                      cy.get('li').eq(itemIndex).should('contain.text', item.text)

                      // We don't check for indentation attributes or classes as per original approach
                    })
                  })
              })
            })
          }

          // Construct a new selector for the nested elements
          const nestedHeadingSelector = `${parentSelector} .heading[level="${level}"]:eq(${headingIndex})`
          // Recursively test nested headings
          generateHeadingTests(nestedHeadingSelector, heading.contents, heading.title)
        })
      })
    })
  })
}

/**
 * Analyzes a document structure to count headings by level
 * @param {Object} documentStructure - The document structure to analyze
 * @returns {Object} - Object with heading levels as keys and counts as values
 */
function analyzeHeadingCounts(documentStructure) {
  const counts = {}

  // Count level 1 headings (sections)
  counts['1'] = documentStructure.sections.length

  // Count all other heading levels recursively
  documentStructure.sections.forEach((section) => {
    countHeadingsRecursive(section.contents, counts)
  })

  return counts
}

/**
 * Registers the document structure validator as a Cypress command
 * This allows validation to be used directly in Cypress tests with good reporting
 */
export function registerDocumentValidator() {
  /**
   * Custom command to validate document structure hierarchy
   * @param {Object} documentStructure - The document structure to validate
   * @param {Object} options - Options for the validation
   * @param {boolean} options.throwOnError - Whether to throw an error if validation fails (default: false)
   * @param {boolean} options.logResults - Whether to log the validation results to the Cypress log (default: true)
   * @param {boolean} options.verbose - Whether to include detailed validation info even for valid documents (default: false)
   * @example
   * // Will validate and log results, but not throw error
   * cy.validateDocumentStructure(myDocStructure);
   *
   * // Will validate, log results and throw error if invalid
   * cy.validateDocumentStructure(myDocStructure, { throwOnError: true });
   */
  Cypress.Commands.add('validateDocumentStructure', (documentStructure, options = {}) => {
    const defaultOptions = {
      throwOnError: false,
      logResults: true,
      verbose: false
    }

    const opts = { ...defaultOptions, ...options }
    const result = validateDocumentStructure(documentStructure)

    if (opts.logResults) {
      if (result.valid) {
        Cypress.log({
          name: 'validateDoc',
          displayName: '✅ Valid Document',
          message: `Document "${documentStructure.documentName}" structure is valid`,
          consoleProps: () => ({
            'Document Name': documentStructure.documentName,
            'Section Count': documentStructure.sections.length,
            'Validation Result': 'Valid',
            'Full Document Structure': documentStructure
          })
        })
      } else {
        // Get a detailed report with heading structure visualization
        const report = validateDocumentWithReport(documentStructure, { verbose: true })

        Cypress.log({
          name: 'validateDoc',
          displayName: '❌ Invalid Document',
          message: result.error,
          consoleProps: () => ({
            'Document Name': documentStructure.documentName || 'Missing name',
            'Section Count': documentStructure.sections?.length || 0,
            'Validation Error': result.error,
            'Heading Structure': report.headingStructure,
            'Full Document Structure': documentStructure
          })
        })
      }
    }

    if (!result.valid && opts.throwOnError) {
      throw new Error(`Document validation failed: ${result.error}`)
    }

    // Return the validation result so it can be used in assertions
    return cy.wrap(result, { log: false })
  })
}

/**
 * Validates document structure and returns a detailed report
 * @param {Object} documentStructure - The document structure to validate
 * @param {Object} options - Options for validation reporting
 * @param {boolean} options.verbose - Whether to include detailed validation info even for valid documents
 * @returns {Object} - Detailed validation report
 */
export function validateDocumentWithReport(documentStructure, options = {}) {
  const defaultOptions = {
    verbose: false
  }

  const opts = { ...defaultOptions, ...options }
  const validationResult = validateDocumentStructure(documentStructure)

  // Create detailed report
  const report = {
    isValid: validationResult.valid,
    documentName: documentStructure.documentName || 'Missing document name',
    sectionCount: documentStructure.sections?.length || 0,
    headingCounts: {},
    error: validationResult.error || null,
    details: 'Document structure validation completed.',
    headingStructure: []
  }

  // Add heading counts if document has valid structure
  if (documentStructure.sections && Array.isArray(documentStructure.sections)) {
    report.headingCounts = analyzeHeadingCounts(documentStructure)

    // Build a visualization of the heading structure
    if (opts.verbose || !validationResult.valid) {
      report.headingStructure = buildHeadingStructureReport(documentStructure)
    }

    if (validationResult.valid) {
      report.details = `Document "${report.documentName}" has a valid structure with:
- ${report.sectionCount} sections
${Object.entries(report.headingCounts)
  .filter(([level]) => level !== '1')
  .map(([level, count]) => `- ${count} H${level} heading${count !== 1 ? 's' : ''}`)
  .join('\n')}`

      if (opts.verbose) {
        report.details += `\n\nHeading structure:\n${report.headingStructure.join('\n')}`
      }
    } else {
      report.details = `Document "${report.documentName}" has an invalid structure:\n- ${validationResult.error}\n\nHeading structure:\n${report.headingStructure.join('\n')}`
    }
  }

  return report
}

/**
 * Builds a visual representation of the document heading structure
 * @param {Object} documentStructure - The document structure to analyze
 * @returns {Array} - Array of strings representing the heading structure
 */
function buildHeadingStructureReport(documentStructure) {
  const result = []

  documentStructure.sections.forEach((section, index) => {
    result.push(`Section ${index + 1} (H1): "${section.title}"`)
    buildHeadingStructureRecursive(section.contents, result, 1, '  ')
  })

  return result
}

/**
 * Recursively builds the heading structure visualization
 * @param {Array} contents - Array of content objects
 * @param {Array} result - Array to accumulate visualization lines
 * @param {number} parentLevel - Level of the parent heading
 * @param {string} indent - Current indentation string
 */
function buildHeadingStructureRecursive(contents, result, parentLevel, indent) {
  if (!contents || !Array.isArray(contents)) return

  contents.forEach((content) => {
    if (content.type === 'heading') {
      // Add this heading to the result
      result.push(`${indent}H${content.level}: "${content.title}"`)

      // Check if this heading follows the hierarchy rules
      const isValid =
        parentLevel === 1
          ? content.level >= 2 && content.level <= 9
          : content.level === parentLevel + 1

      if (!isValid) {
        result[result.length - 1] += ` ⚠️ INVALID: Should be H${parentLevel + 1}`
      }

      // Recursively process the heading's contents
      buildHeadingStructureRecursive(content.contents, result, content.level, indent + '  ')
    }
  })
}

/**
 * Validates that a document structure follows proper heading level hierarchy
 * @param {Object} documentStructure - The document structure to validate
 * @returns {Object} - { valid: boolean, error: string } result of validation
 */
export function validateDocumentStructure(documentStructure) {
  // Check if document has required properties
  if (!documentStructure || !documentStructure.documentName) {
    return { valid: false, error: 'Document structure is missing documentName' }
  }

  if (
    !documentStructure.sections ||
    !Array.isArray(documentStructure.sections) ||
    documentStructure.sections.length === 0
  ) {
    return { valid: false, error: 'Document must have at least one section' }
  }

  // Validate each section
  for (let i = 0; i < documentStructure.sections.length; i++) {
    const section = documentStructure.sections[i]

    // Verify section properties
    if (!section.title) {
      return { valid: false, error: `Section ${i + 1} is missing a title` }
    }

    if (!section.contents || !Array.isArray(section.contents)) {
      return { valid: false, error: `Section ${i + 1} is missing contents array` }
    }

    // Check for nested sections (sections should not contain other sections)
    const nestedSectionCheck = checkForNestedSections(section.contents)
    if (!nestedSectionCheck.valid) {
      return {
        valid: false,
        error: `Section "${section.title}" (index ${i}): ${nestedSectionCheck.error}`
      }
    }

    // Check heading hierarchy within the section
    const headingValidation = validateHeadingHierarchy(section.contents, 1, section.title)
    if (!headingValidation.valid) {
      return {
        valid: false,
        error: `Section "${section.title}" (index ${i}): ${headingValidation.error}`
      }
    }
  }

  return { valid: true }
}

/**
 * Checks if there are sections nested within contents
 * @param {Array} contents - Array of content objects to check
 * @returns {Object} - { valid: boolean, error: string } result of validation
 */
function checkForNestedSections(contents) {
  if (!contents || !Array.isArray(contents)) {
    return { valid: true }
  }

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i]

    // If content is a section, it's an error
    if (content.type === 'section') {
      return { valid: false, error: `Nested section found at index ${i}` }
    }

    // Recursively check content arrays
    if (content.contents && Array.isArray(content.contents)) {
      const nestedCheck = checkForNestedSections(content.contents)
      if (!nestedCheck.valid) {
        return nestedCheck
      }
    }
  }

  return { valid: true }
}

/**
 * Recursively validates heading hierarchy within content
 * @param {Array} contents - Array of content objects to validate
 * @param {number} parentLevel - Level of the parent heading
 * @param {string} parentTitle - Title of the parent heading for error context
 * @returns {Object} - { valid: boolean, error: string } result of validation
 */
function validateHeadingHierarchy(contents, parentLevel, parentTitle) {
  if (!contents || !Array.isArray(contents)) {
    return { valid: true }
  }

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i]

    if (content.type === 'heading') {
      // Check heading properties
      if (!content.title) {
        return { valid: false, error: `Heading at index ${i} is missing a title` }
      }

      if (!content.contents || !Array.isArray(content.contents)) {
        return { valid: false, error: `Heading "${content.title}" is missing contents array` }
      }

      // Validate heading level - child level must be greater than parent level
      // The only exception is if parent is level 1 (section), headings can be any level from 2-9
      if (parentLevel === 1) {
        if (content.level < 2 || content.level > 9) {
          return {
            valid: false,
            error: `Invalid heading level: "${content.title}" has level ${content.level}, but should be between 2-9 under level 1 parent "${parentTitle}"`
          }
        }
      } else {
        // For all other cases, heading level must be greater than parent level
        if (content.level <= parentLevel) {
          return {
            valid: false,
            error: `Invalid heading level: "${content.title}" has level ${content.level}, but should be greater than parent level ${parentLevel} "${parentTitle}"`
          }
        }
      }

      // Recursively validate nested headings
      const nestedValidation = validateHeadingHierarchy(
        content.contents,
        content.level,
        content.title
      )
      if (!nestedValidation.valid) {
        return nestedValidation
      }
    }
  }

  return { valid: true }
}

/**
 * Recursively counts headings in content arrays
 * @param {Array} contents - Array of content objects
 * @param {Object} counts - Object to accumulate counts
 */
function countHeadingsRecursive(contents, counts) {
  if (!contents || !Array.isArray(contents)) return

  contents.forEach((content) => {
    if (content.type === 'heading') {
      const level = content.level.toString()
      counts[level] = (counts[level] || 0) + 1

      // Recursively count headings in this heading's contents
      if (content.contents && Array.isArray(content.contents)) {
        countHeadingsRecursive(content.contents, counts)
      }
    }
  })
}
