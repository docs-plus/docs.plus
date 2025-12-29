/* eslint-disable no-undef */
/**
 * Complex Structure Tests for TOC Drag and Drop
 *
 * Tests edge cases from Editor_Schema_Rules_v3.md:
 * - Multiple sections (H1 forest)
 * - Deep nesting (H1 → H2 → H3 → H4 → H5)
 * - STACK-ATTACH algorithm behavior
 * - Moving headings between sections
 * - Skip-level nesting (H1 → H4 is valid)
 * - Sibling relationships at various levels
 */

import { TEST_CONTENT } from '../../../support/commands'
import { heading, paragraph, section } from '../../../fixtures/docMaker'

// =============================================================================
// COMPLEX TEST DOCUMENTS
// =============================================================================

/**
 * Multi-section document with 3 H1 sections
 * Tests forest structure and cross-section moves
 */
const MultiSectionForest = {
  documentName: 'Complex - Multi Section Forest',
  sections: [
    section('Section Alpha', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Alpha Child 1', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Alpha Child 2', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Alpha Grandchild', [paragraph(TEST_CONTENT.short)])
      ])
    ]),
    section('Section Beta', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Beta Child 1', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Beta Child 2', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Section Gamma', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Gamma Child 1', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Gamma Deep 1', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Gamma Deeper', [paragraph(TEST_CONTENT.short)])
        ])
      ])
    ])
  ]
}

/**
 * Deep chain: H1 → H2 → H3 → H4 → H5
 * Tests STACK-ATTACH with maximum nesting
 */
const DeepChainDocument = {
  documentName: 'Complex - Deep Chain',
  sections: [
    section('Root Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Level 2', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Level 4', [
            paragraph(TEST_CONTENT.short),
            heading(5, 'Level 5', [
              paragraph(TEST_CONTENT.short),
              heading(6, 'Level 6', [paragraph(TEST_CONTENT.short)])
            ])
          ])
        ])
      ])
    ])
  ]
}

/**
 * Multiple siblings at each level
 * Tests: H1 → H2 |→ H2 |→ H2 (three H2 siblings)
 */
const ManySiblingsDocument = {
  documentName: 'Complex - Many Siblings',
  sections: [
    section('Parent Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Sibling A', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Sibling B', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Sibling C', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Sibling D', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'D Child 1', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'D Child 2', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'D Child 3', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

/**
 * Skip-level nesting: H1 → H4 is valid per spec
 * STACK-ATTACH attaches to nearest ancestor with lower level
 */
const SkipLevelDocument = {
  documentName: 'Complex - Skip Level',
  sections: [
    section('Skip Level Root', [
      paragraph(TEST_CONTENT.short),
      heading(4, 'Direct H4 under H1', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'H5 under H4', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Normal H2', [
        paragraph(TEST_CONTENT.short),
        heading(5, 'H5 skipping H3 and H4', [paragraph(TEST_CONTENT.short)])
      ])
    ])
  ]
}

/**
 * Mixed complexity document
 * Combines multiple patterns for stress testing
 */
const MixedComplexityDocument = {
  documentName: 'Complex - Mixed Patterns',
  sections: [
    section('First Root', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First H2', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Deep A', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Deeper A', [paragraph(TEST_CONTENT.short)])
        ]),
        heading(3, 'Deep B', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Second H2', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Second Root', [
      paragraph(TEST_CONTENT.short),
      heading(3, 'Skip to H3', [
        paragraph(TEST_CONTENT.short),
        heading(4, 'Under Skip H3', [paragraph(TEST_CONTENT.short)])
      ]),
      heading(2, 'Normal After Skip', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

// =============================================================================
// HELPER
// =============================================================================
let testCounter = 0

function takeScreenshots(testName, action) {
  testCounter++
  const prefix = `complex-${testCounter.toString().padStart(2, '0')}-${testName.replace(/\s+/g, '-').toLowerCase()}`

  cy.screenshot(`${prefix}-1-before`)
  action()
  cy.wait(500)
  cy.screenshot(`${prefix}-2-after`)
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('TOC Complex Structure Tests', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, docName: 'toc-complex-test', clearDoc: true })
    cy.wait(500)
  })

  // ===========================================================================
  // CROSS-SECTION MOVEMENT
  // ===========================================================================
  describe('Cross-Section Movement', () => {
    beforeEach(() => {
      cy.createDocument(MultiSectionForest)
      cy.waitForToc()
    })

    it('should move H2 from Section Alpha to Section Beta', () => {
      takeScreenshots('move-h2-alpha-to-beta', () => {
        // Move "Alpha Child 1" after "Beta Child 2"
        cy.dragTocItem('Alpha Child 1', 'Beta Child 2', { position: 'after', level: 2 })
      })

      cy.get('.toc__list').should('contain.text', 'Alpha Child 1')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move H3 from Alpha to Gamma section', () => {
      takeScreenshots('move-h3-alpha-to-gamma', () => {
        // Move "Alpha Grandchild" after "Gamma Deep 1" as sibling H3
        cy.dragTocItem('Alpha Grandchild', 'Gamma Deep 1', { position: 'after', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Alpha Grandchild')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should promote H2 from Beta to new H1 section', () => {
      takeScreenshots('promote-h2-to-h1-new-section', () => {
        // Move "Beta Child 1" after "Section Gamma" as new H1
        cy.dragTocItem('Beta Child 1', 'Section Gamma', { position: 'after', level: 1 })
      })

      cy.get('.toc__list').should('contain.text', 'Beta Child 1')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should demote entire H1 section into another section', () => {
      takeScreenshots('demote-h1-into-another', () => {
        // Demote "Section Beta" to H2 inside "Section Alpha"
        cy.dragTocItem('Section Beta', 'Alpha Child 2', { position: 'after', level: 2 })
      })

      cy.get('.toc__list').should('contain.text', 'Section Beta')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // DEEP CHAIN OPERATIONS
  // ===========================================================================
  describe('Deep Chain Operations', () => {
    beforeEach(() => {
      cy.createDocument(DeepChainDocument)
      cy.waitForToc()
    })

    it('should promote H5 to H3 (skip two levels up)', () => {
      takeScreenshots('promote-h5-to-h3', () => {
        cy.dragTocItem('Level 5', 'Level 3', { position: 'after', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Level 5')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should promote H6 to H2 (extreme promotion)', () => {
      takeScreenshots('promote-h6-to-h2', () => {
        cy.dragTocItem('Level 6', 'Level 2', { position: 'after', level: 2 })
      })

      cy.get('.toc__list').should('contain.text', 'Level 6')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should demote H6 to H7 (deeper nesting)', () => {
      takeScreenshots('demote-h6-to-h7', () => {
        // Move Level 6 after Level 5 with level 7 (becomes child of Level 5 instead of Level 5's sibling)
        cy.dragTocItem('Level 6', 'Level 5', { position: 'after', level: 7 })
      })

      cy.get('.toc__list').should('contain.text', 'Level 6')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move H4 before H3 as sibling', () => {
      takeScreenshots('move-h4-before-h3', () => {
        // Move H4 before H3 with level 3 (becomes sibling of H3)
        cy.dragTocItem('Level 4', 'Level 3', { position: 'before', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Level 4')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // SIBLING OPERATIONS
  // ===========================================================================
  describe('Sibling Reordering', () => {
    beforeEach(() => {
      cy.createDocument(ManySiblingsDocument)
      cy.waitForToc()
    })

    it('should move last sibling to first position', () => {
      takeScreenshots('move-sibling-d-to-first', () => {
        cy.dragTocItem('Sibling D', 'Sibling A', { position: 'before' })
      })

      cy.get('.toc__list').should('contain.text', 'Sibling D')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move first sibling to last position', () => {
      takeScreenshots('move-sibling-a-to-last', () => {
        cy.dragTocItem('Sibling A', 'Sibling D', { position: 'after' })
      })

      cy.get('.toc__list').should('contain.text', 'Sibling A')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should swap middle siblings', () => {
      takeScreenshots('swap-middle-siblings', () => {
        cy.dragTocItem('Sibling B', 'Sibling C', { position: 'after' })
      })

      cy.get('.toc__list').should('contain.text', 'Sibling B')
      cy.get('.toc__list').should('contain.text', 'Sibling C')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should nest sibling into another sibling', () => {
      takeScreenshots('nest-sibling-into-sibling', () => {
        // Move "Sibling A" into "Sibling D" as H3
        cy.dragTocItem('Sibling A', 'Sibling D', { position: 'after', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Sibling A')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move D Child between siblings at H3 level', () => {
      takeScreenshots('reorder-d-children', () => {
        cy.dragTocItem('D Child 3', 'D Child 1', { position: 'before' })
      })

      cy.get('.toc__list').should('contain.text', 'D Child 3')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // SKIP-LEVEL NESTING (STACK-ATTACH EDGE CASES)
  // ===========================================================================
  describe('Skip-Level Nesting (STACK-ATTACH)', () => {
    beforeEach(() => {
      cy.createDocument(SkipLevelDocument)
      cy.waitForToc()
    })

    it('should allow H4 directly under H1 (valid per spec)', () => {
      // This is already the initial structure, verify it's valid
      cy.get('.toc__list').should('contain.text', 'Direct H4 under H1')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move H5 to be direct child of H1 (skip-level)', () => {
      takeScreenshots('move-h5-under-h1', () => {
        // Move "H5 under H4" directly under H1 as H4
        cy.dragTocItem('H5 under H4', 'Skip Level Root', { position: 'after', level: 4 })
      })

      cy.get('.toc__list').should('contain.text', 'H5 under H4')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move Normal H2 after skip-level H4', () => {
      takeScreenshots('move-h2-after-skip-h4', () => {
        cy.dragTocItem('Normal H2', 'Direct H4 under H1', { position: 'after' })
      })

      cy.get('.toc__list').should('contain.text', 'Normal H2')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // MIXED COMPLEXITY STRESS TEST
  // ===========================================================================
  describe('Mixed Complexity Stress Test', () => {
    beforeEach(() => {
      cy.createDocument(MixedComplexityDocument)
      cy.waitForToc()
    })

    it('should handle multiple moves in sequence', () => {
      cy.screenshot('stress-1-initial')

      // Move 1: Promote Deep A to H2
      cy.dragTocItem('Deep A', 'First H2', { position: 'after', level: 2 })
      cy.wait(300)
      cy.screenshot('stress-2-after-move-1')

      // Move 2: Move Deep B after Second H2
      cy.dragTocItem('Deep B', 'Second H2', { position: 'after', level: 2 })
      cy.wait(300)
      cy.screenshot('stress-3-after-move-2')

      // Move 3: Reorder - move Under Skip H3 after Normal After Skip
      cy.dragTocItem('Under Skip H3', 'Normal After Skip', { position: 'after', level: 3 })
      cy.wait(300)
      cy.screenshot('stress-4-after-move-3')

      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move heading from one section to nested position in another', () => {
      takeScreenshots('cross-section-deep-nest', () => {
        // Move "Skip to H3" into "First H2" as H3
        cy.dragTocItem('Skip to H3', 'Deep B', { position: 'after', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Skip to H3')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should merge sections by demoting one H1 into another', () => {
      takeScreenshots('merge-sections', () => {
        // Demote "Second Root" into "First Root" as H2
        cy.dragTocItem('Second Root', 'Second H2', { position: 'after', level: 2 })
      })

      cy.get('.toc__list').should('contain.text', 'Second Root')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // EDGE CASES FROM SPEC
  // ===========================================================================
  describe('Schema Edge Cases', () => {
    beforeEach(() => {
      cy.createDocument(MixedComplexityDocument)
      cy.waitForToc()
    })

    it('should validate STACK-ATTACH: each child level > parent level', () => {
      // After any operation, verify STACK-ATTACH invariant
      cy.dragTocItem('Deep B', 'First Root', { position: 'after', level: 2 })
      cy.wait(300)

      // Verify each heading's parent has lower level
      cy.get('.heading').each(($heading) => {
        const level = parseInt($heading.attr('level') || '1')
        if (level > 1) {
          const $parent = $heading.parents('.heading').first()
          if ($parent.length) {
            const parentLevel = parseInt($parent.attr('level') || '1')
            expect(parentLevel, `Parent of H${level} should have lower level`).to.be.lessThan(level)
          }
        }
      })

      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should ensure H1 sections remain valid', () => {
      // Test that H1 operations maintain valid structure
      takeScreenshots('h1-validity', () => {
        // Move Deep B to be after Second H2 as sibling
        cy.dragTocItem('Deep B', 'Second H2', { position: 'after', level: 2 })
      })

      // Verify structure is still valid
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should handle rapid consecutive moves without corruption', () => {
      // Rapid fire moves
      cy.dragTocItem('Deep A', 'Deep B', { position: 'after' })
      cy.dragTocItem('Deeper A', 'First H2', { position: 'after', level: 3 })
      cy.dragTocItem('Second H2', 'First H2', { position: 'before' })

      cy.wait(500)
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })
})
