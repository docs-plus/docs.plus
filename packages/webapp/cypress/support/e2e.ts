// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import 'cypress-real-events'
import './commands'
import './schemaValidator'
import './domSchemaValidator'

/**
 * Global afterEach hook for STRICT schema validation
 *
 * Runs after EVERY editor test to ensure:
 * 1. ProseMirror internal state follows HN-10 rules
 * 2. HTML DOM structure matches the expected nesting
 *
 * This catches hidden issues that might not be visible in the UI.
 */
afterEach(function () {
  const testFile = Cypress.spec.relative || ''

  // Apply strict validation to all editor tests
  const isEditorTest =
    testFile.includes('/editor/') ||
    testFile.includes('copy-paste') ||
    testFile.includes('clipboard') ||
    testFile.includes('Heading') ||
    testFile.includes('schema') ||
    testFile.includes('Toc') ||
    testFile.includes('user-behavior') ||
    testFile.includes('keyboard-action') ||
    testFile.includes('doc-schema') ||
    testFile.includes('doc-structure') ||
    testFile.includes('e2e-heading') ||
    testFile.includes('e2e-doc')

  if (!isEditorTest) return

  // Check if editor exists before validation
  cy.window({ log: false }).then((win) => {
    if (!win._editor) return

    // STEP 1: Validate ProseMirror internal state (STRICT)
    cy.validateDocumentSchema().then((pmResult) => {
      if (!pmResult.skipped && !pmResult.valid) {
        cy.log('❌ PROSEMIRROR SCHEMA VIOLATIONS:')
        pmResult.errors.forEach((err) => cy.log(`   ${err}`))

        // STRICT: Fail the test
        expect(pmResult.valid, `ProseMirror Schema invalid:\n${pmResult.errors.join('\n')}`).to.be
          .true
      }
    })

    // STEP 2: Validate HTML DOM structure (STRICT)
    cy.validateDOMSchema().then((domResult) => {
      if (!domResult.valid) {
        cy.log('❌ DOM SCHEMA VIOLATIONS:')
        domResult.errors.forEach((err) => cy.log(`   ${err}`))

        // Log structure for debugging
        cy.log('📋 Current DOM Structure:')
        domResult.structure?.forEach((h: any) => {
          const parentInfo = h.parentLevel ? `inside H${h.parentLevel}` : 'ROOT'
          cy.log(`   H${h.level}: "${h.title}" (${parentInfo})`)
        })

        // STRICT: Fail the test
        expect(domResult.valid, `DOM Schema invalid:\n${domResult.errors.join('\n')}`).to.be.true
      }
    })
  })
})
