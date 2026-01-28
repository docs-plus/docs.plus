/* eslint-disable no-undef */
/**
 * HTML DOM Schema Validator for HN-10 Rules
 *
 * This validator directly checks the rendered HTML DOM structure,
 * NOT the ProseMirror internal state. It's complementary to the
 * ProseMirror schema validation.
 *
 * Key Rule: Headings with level N must be inside the contentWrapper
 * of a parent heading with level < N. If a heading is at the
 * editor root level (direct child of .ProseMirror), it must be H1.
 */

/**
 * Validates the HTML DOM structure against HN-10 rules
 * @returns {Promise<{valid: boolean, errors: string[], structure: object[]}>}
 */
Cypress.Commands.add('validateDOMSchema', () => {
  return cy.get('.docy_editor .ProseMirror').then(($editor) => {
    const errors = []
    const structure = []

    // Get all heading elements in the DOM
    const headings = $editor.find('.heading[level]')

    headings.each((index, headingEl) => {
      const $heading = Cypress.$(headingEl)
      const level = parseInt($heading.attr('level'), 10)
      const dataId = $heading.attr('data-id') || 'unknown'
      // Use > .title to get only direct child title (contentHeading node), not nested ones
      const title = $heading.children('.title').text().substring(0, 30) || 'Untitled'

      // Find the parent heading (if any)
      // ContentWrapper contains a .contents div, so use .closest() to find contentWrapper ancestor
      const $parentContentWrapper = $heading.closest('.contentWrapper')
      // Then find the heading that contains this contentWrapper
      const $parentHeading = $parentContentWrapper.closest('.heading[level]')

      const parentLevel =
        $parentHeading.length > 0 ? parseInt($parentHeading.attr('level'), 10) : null
      const parentTitle =
        $parentHeading.length > 0 ? $parentHeading.children('.title').text().substring(0, 30) : null

      // Check if this heading is at the editor root level
      // A heading is at root if it's not inside another heading's contentWrapper
      const isAtEditorRoot = $parentHeading.length === 0

      structure.push({
        level,
        title,
        dataId,
        parentLevel,
        parentTitle,
        isAtEditorRoot
      })

      // Rule 1: H1 must be at editor root (not inside another heading's contentWrapper)
      if (level === 1 && !isAtEditorRoot) {
        errors.push(
          `[DOM_H1_NESTED] H1 "${title}" is nested inside H${parentLevel} "${parentTitle}" - H1 must be at document root`
        )
      }

      // Rule 2: H2-H10 must be inside a parent heading's contentWrapper
      if (level > 1 && isAtEditorRoot) {
        errors.push(
          `[DOM_H${level}_AT_ROOT] H${level} "${title}" is at editor root - must be nested inside a parent heading`
        )
      }

      // Rule 3: Child level must be > parent level
      if (parentLevel !== null && level <= parentLevel) {
        errors.push(
          `[DOM_INVALID_NESTING] H${level} "${title}" is inside H${parentLevel} "${parentTitle}" - child level must be > parent level`
        )
      }

      // Rule 4: Level must be 1-10
      if (level < 1 || level > 10) {
        errors.push(`[DOM_INVALID_LEVEL] H${level} "${title}" - level must be 1-10`)
      }
    })

    // Additional check: siblings at the same DOM level
    // If two headings are siblings, they should have valid relationship
    // ContentWrapper contains a .contents div that holds the actual content
    $editor.find('.contentWrapper').each((_, cwEl) => {
      const $cw = Cypress.$(cwEl)
      const $parentHeading = $cw.closest('.heading[level]')
      const parentLevel = $parentHeading.length > 0 ? parseInt($parentHeading.attr('level'), 10) : 0

      // Get child headings (they're inside .contents, not directly in contentWrapper)
      const $childHeadings = $cw.find('> .contents > .heading[level], > .heading[level]')

      $childHeadings.each((idx, childEl) => {
        const $child = Cypress.$(childEl)
        const childLevel = parseInt($child.attr('level'), 10)
        const childTitle = $child.children('.title').text().substring(0, 30)

        if (childLevel <= parentLevel) {
          const parentTitle = $parentHeading.children('.title').text().substring(0, 30)
          errors.push(
            `[DOM_SIBLING_VIOLATION] H${childLevel} "${childTitle}" is sibling inside H${parentLevel} "${parentTitle}" contentWrapper - invalid hierarchy`
          )
        }
      })
    })

    // Check direct children of .ProseMirror - should only be H1s
    const $directRootHeadings = $editor.children('.heading[level]')
    $directRootHeadings.each((_, el) => {
      const $h = Cypress.$(el)
      const level = parseInt($h.attr('level'), 10)
      const title = $h.children('.title').text().substring(0, 30)

      if (level !== 1) {
        errors.push(
          `[DOM_ROOT_NOT_H1] H${level} "${title}" is a direct child of editor root - only H1 allowed at root`
        )
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
      structure
    }
  })
})

/**
 * Asserts the HTML DOM schema is valid
 * Use in afterEach hooks for comprehensive validation
 */
Cypress.Commands.add('assertValidDOMSchema', () => {
  cy.validateDOMSchema().then((result) => {
    if (!result.valid) {
      cy.log('❌ DOM SCHEMA VIOLATIONS DETECTED:')
      result.errors.forEach((err) => {
        cy.log(`   ${err}`)
      })

      // Also log the structure for debugging
      cy.log('📋 DOM Structure:')
      result.structure.forEach((h) => {
        const parentInfo = h.parentLevel ? ` (inside H${h.parentLevel})` : ' (ROOT)'
        cy.log(`   H${h.level}: ${h.title}${parentInfo}`)
      })
    }

    expect(result.valid, `DOM Schema validation failed:\n${result.errors.join('\n')}`).to.be.true
  })
})

/**
 * Logs the HTML DOM structure for debugging
 */
Cypress.Commands.add('logDOMStructure', () => {
  cy.get('.docy_editor .ProseMirror').then(($editor) => {
    const headings = $editor.find('.heading[level]')

    cy.log('=== HTML DOM Structure ===')
    headings.each((index, el) => {
      const $h = Cypress.$(el)
      const level = parseInt($h.attr('level'), 10)
      const title = $h.children('.title').text().substring(0, 40) || 'Untitled'
      const dataId = $h.attr('data-id')

      // Find parent heading - use closest() to traverse up through .contents and .contentWrapper
      const $parentCW = $h.closest('.contentWrapper')
      const $parentHeading = $parentCW.closest('.heading[level]')
      const parentLevel = $parentHeading.length > 0 ? $parentHeading.attr('level') : 'ROOT'

      // Visual indent based on level
      const indent = '  '.repeat(level - 1)
      cy.log(`${indent}H${level}: "${title}" [parent: ${parentLevel}] [id: ${dataId}]`)
    })
    cy.log('========================')
  })
})

/**
 * Combined validation: both ProseMirror AND DOM
 */
Cypress.Commands.add('assertFullSchemaValid', () => {
  cy.assertValidSchema() // ProseMirror internal state
  cy.assertValidDOMSchema() // Rendered HTML DOM
})
