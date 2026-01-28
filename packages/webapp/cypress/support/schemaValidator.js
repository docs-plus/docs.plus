/* eslint-disable no-undef */
/**
 * Schema Validator for HN-10 Rules
 *
 * This module provides schema validation utilities for the custom heading
 * hierarchy. It can be used in afterEach hooks to ensure every test
 * leaves the document in a valid state.
 *
 * HN-10 Rules:
 * 1. H1 is ONLY at document root (depth 1)
 * 2. H2-H10 must be nested inside a parent heading
 * 3. Child level must be > parent level
 * 4. Levels range from 1-10
 */

/**
 * Validates the document schema and returns errors
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
Cypress.Commands.add('validateDocumentSchema', () => {
  return cy.window().then((win) => {
    const editor = win._editor
    if (!editor) {
      return { valid: true, errors: [], skipped: true }
    }

    const doc = editor.state.doc
    const errors = []
    const headingStack = []

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.firstChild?.attrs?.level || 1
        const $pos = doc.resolve(pos)
        const depth = $pos.depth
        const endPos = pos + node.nodeSize
        const title = node.firstChild?.textContent?.substring(0, 25) || 'Untitled'

        // Rule 1: H1 should only be at depth 1 (document root)
        if (level === 1 && depth > 1) {
          errors.push(`[H1_NESTED] H1 "${title}" at depth ${depth} (should be 1)`)
        }

        // Rule 2: H2+ should NOT be at depth 1 (must be nested)
        if (level > 1 && depth === 1) {
          errors.push(`[H${level}_AT_ROOT] H${level} "${title}" at root (should be nested)`)
        }

        // Rule 3: Check parent-child level relationship
        // Pop finished parents from stack
        while (headingStack.length > 0) {
          const parent = headingStack[headingStack.length - 1]
          if (pos >= parent.endPos) {
            headingStack.pop()
          } else {
            break
          }
        }

        if (headingStack.length > 0) {
          const parent = headingStack[headingStack.length - 1]
          if (level <= parent.level) {
            errors.push(
              `[INVALID_NESTING] H${level} "${title}" inside H${parent.level} "${parent.title}" (child must be > parent)`
            )
          }
        }

        // Rule 4: Level must be 1-10
        if (level < 1 || level > 10) {
          errors.push(`[INVALID_LEVEL] H${level} "${title}" (must be 1-10)`)
        }

        headingStack.push({ pos, level, endPos, title })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length
    }
  })
})

/**
 * Asserts the document schema is valid
 * Use in afterEach hooks for comprehensive validation
 */
Cypress.Commands.add('assertValidSchema', () => {
  cy.validateDocumentSchema().then((result) => {
    if (!result.skipped && !result.valid) {
      // Log all errors for debugging
      cy.log('❌ SCHEMA VIOLATIONS DETECTED:')
      result.errors.forEach((err) => {
        cy.log(`   ${err}`)
      })
    }
    // Only assert if not skipped (editor exists)
    if (!result.skipped) {
      expect(result.valid, `Schema validation failed with ${result.errorCount} errors`).to.be.true
    }
  })
})

/**
 * Gets a summary of the document structure for debugging
 */
Cypress.Commands.add('logDocumentStructure', () => {
  cy.window().then((win) => {
    const editor = win._editor
    if (!editor) return

    const doc = editor.state.doc
    const structure = []

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.firstChild?.attrs?.level || 1
        const title = node.firstChild?.textContent?.substring(0, 30) || 'Untitled'
        const $pos = doc.resolve(pos)
        structure.push({
          level: `H${level}`,
          title,
          depth: $pos.depth,
          pos
        })
      }
    })

    cy.log('Document Structure:')
    structure.forEach((h) => {
      const indent = '  '.repeat(h.depth)
      cy.log(`${indent}${h.level}: ${h.title}`)
    })
  })
})
