import { TEST_CONTENT } from '../../../support/commands'
import { heading, paragraph, section } from '../../../fixtures/docMaker'

// =============================================================================
// TEST DOCUMENTS
// =============================================================================

const SimpleSiblingsDocument = {
  documentName: 'TOC Drag - Simple Siblings',
  sections: [
    section('Main Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'First Heading', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Second Heading', [paragraph(TEST_CONTENT.short)]),
      heading(2, 'Third Heading', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

const NestedDocument = {
  documentName: 'TOC Drag - Nested Structure',
  sections: [
    section('Parent Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Level 2 Parent', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'Level 3 Child', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'Level 4 Grandchild', [paragraph(TEST_CONTENT.short)])
        ])
      ]),
      heading(2, 'Another Level 2', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

const MultiSectionDocument = {
  documentName: 'TOC Drag - Multi Section',
  sections: [
    section('First Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Section 1 Heading', [paragraph(TEST_CONTENT.short)])
    ]),
    section('Second Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'Section 2 Heading', [paragraph(TEST_CONTENT.short)])
    ])
  ]
}

const DeepNestingDocument = {
  documentName: 'TOC Drag - Deep Nesting',
  sections: [
    section('Deep Section', [
      paragraph(TEST_CONTENT.short),
      heading(2, 'H2 Container', [
        paragraph(TEST_CONTENT.short),
        heading(3, 'H3 Inside H2', [paragraph(TEST_CONTENT.short)]),
        heading(3, 'Another H3', [
          paragraph(TEST_CONTENT.short),
          heading(4, 'H4 Inside Another H3', [
            paragraph(TEST_CONTENT.short),
            heading(5, 'H5 Deep', [paragraph(TEST_CONTENT.short)])
          ])
        ])
      ])
    ])
  ]
}

// =============================================================================
// HELPER: Screenshot wrapper for before/after
// =============================================================================
let testCounter = 0

function takeScreenshots(testName, action) {
  testCounter++
  const prefix = `${testCounter.toString().padStart(2, '0')}-${testName.replace(/\s+/g, '-').toLowerCase()}`

  cy.screenshot(`${prefix}-1-before`)
  action()
  cy.wait(500)
  cy.screenshot(`${prefix}-2-after`)
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('TOC Drag and Drop', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, docName: 'toc-drag-test', clearDoc: true })
    cy.wait(500)
  })

  // ===========================================================================
  // BASIC MOVEMENT TESTS
  // ===========================================================================
  describe('Basic Movement - Same Level', () => {
    beforeEach(() => {
      cy.createDocument(SimpleSiblingsDocument)
      cy.waitForToc()
    })

    it('should move heading after sibling at same level', () => {
      takeScreenshots('move-after-sibling', () => {
        cy.dragTocItem('First Heading', 'Third Heading', { position: 'after' })
      })

      cy.get('.toc__list .toc__item').then(($items) => {
        const texts = $items.map((_, el) => Cypress.$(el).find('.toc__link').first().text()).get()
        expect(texts).to.include('Second Heading')
        expect(texts).to.include('Third Heading')
        expect(texts).to.include('First Heading')
      })

      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move heading before sibling at same level', () => {
      takeScreenshots('move-before-sibling', () => {
        cy.dragTocItem('Third Heading', 'First Heading', { position: 'before' })
      })

      cy.get('.toc__list').should('contain.text', 'Third Heading')
      cy.get('.toc__list').should('contain.text', 'First Heading')
      cy.get('.toc__list').should('contain.text', 'Second Heading')

      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // LEVEL CHANGE TESTS - DEMOTE
  // ===========================================================================
  describe('Level Change - Demote', () => {
    beforeEach(() => {
      cy.createDocument(NestedDocument)
      cy.waitForToc()
    })

    it('should demote H2 to H3 (nest inside target)', () => {
      takeScreenshots('demote-h2-to-h3', () => {
        // Move "Another Level 2" after "Level 2 Parent" with level 3 (demote to H3)
        cy.dragTocItem('Another Level 2', 'Level 2 Parent', { position: 'after', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Another Level 2')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should demote H2 to H4 (nest deeper)', () => {
      takeScreenshots('demote-h2-to-h4', () => {
        // Move "Another Level 2" after "Level 3 Child" with level 4
        cy.dragTocItem('Another Level 2', 'Level 3 Child', { position: 'after', level: 4 })
      })

      cy.get('.toc__list').should('contain.text', 'Another Level 2')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // LEVEL CHANGE TESTS - PROMOTE
  // ===========================================================================
  describe('Level Change - Promote', () => {
    beforeEach(() => {
      cy.createDocument(NestedDocument)
      cy.waitForToc()
    })

    it('should promote H4 to H3 (escape from parent)', () => {
      takeScreenshots('promote-h4-to-h3', () => {
        cy.dragTocItem('Level 4 Grandchild', 'Level 3 Child', { position: 'after', level: 3 })
      })

      cy.get('.toc__list').should('contain.text', 'Level 4 Grandchild')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should promote H3 to H2 (become sibling of parent)', () => {
      takeScreenshots('promote-h3-to-h2', () => {
        cy.dragTocItem('Level 3 Child', 'Level 2 Parent', { position: 'after', level: 2 })
      })

      cy.get('.toc__list').should('contain.text', 'Level 3 Child')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // H1 SPECIAL CASES
  // ===========================================================================
  describe('H1 Special Cases', () => {
    beforeEach(() => {
      cy.createDocument(MultiSectionDocument)
      cy.waitForToc()
    })

    it('should demote H1 to H2 (nest inside another section)', () => {
      takeScreenshots('demote-h1-to-h2', () => {
        cy.dragTocItem('Second Section', 'First Section', { position: 'after', level: 2 })
      })

      cy.get('.toc__list').should('contain.text', 'Second Section')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should promote H2 to H1 (become new section)', () => {
      takeScreenshots('promote-h2-to-h1', () => {
        cy.dragTocItem('Section 1 Heading', 'Second Section', { position: 'after', level: 1 })
      })

      cy.get('.toc__list').should('contain.text', 'Section 1 Heading')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // NESTING AND EXTRACTION TESTS
  // ===========================================================================
  describe('Nesting and Extraction', () => {
    beforeEach(() => {
      cy.createDocument(DeepNestingDocument)
      cy.waitForToc()
    })

    it('should nest H4 inside H3 (after position)', () => {
      takeScreenshots('nest-h4-inside-h3', () => {
        // Move H4 after Another H3 with level 4 (should nest inside)
        cy.dragTocItem('H4 Inside Another H3', 'H3 Inside H2', { position: 'after', level: 4 })
      })

      cy.get('.toc__list').should('contain.text', 'H4 Inside Another H3')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should move sibling H3 after another H3', () => {
      takeScreenshots('move-h3-sibling', () => {
        cy.dragTocItem('Another H3', 'H3 Inside H2', { position: 'before' })
      })

      cy.get('.toc__list').should('contain.text', 'Another H3')
      cy.get('.toc__list').should('contain.text', 'H3 Inside H2')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should insert before target as sibling (not child)', () => {
      takeScreenshots('insert-before-as-sibling', () => {
        cy.dragTocItem('H5 Deep', 'H4 Inside Another H3', { position: 'before', level: 5 })
      })

      cy.get('.toc__list').should('contain.text', 'H5 Deep')
      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })

  // ===========================================================================
  // VALIDATION TESTS
  // ===========================================================================
  describe('Structure Validation', () => {
    beforeEach(() => {
      cy.createDocument(NestedDocument)
      cy.waitForToc()
    })

    it('should maintain valid DOM structure after multiple operations', () => {
      cy.screenshot('multi-ops-1-initial')

      cy.dragTocItem('Level 4 Grandchild', 'Level 2 Parent', { position: 'after', level: 3 })
      cy.wait(300)
      cy.screenshot('multi-ops-2-after-first')

      cy.dragTocItem('Another Level 2', 'Level 2 Parent', { position: 'before' })
      cy.wait(300)
      cy.screenshot('multi-ops-3-after-second')

      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })

    it('should validate STACK-ATTACH rules after drag', () => {
      takeScreenshots('stack-attach-validation', () => {
        cy.dragTocItem('Level 3 Child', 'Another Level 2', { position: 'after', level: 3 })
      })

      cy.get('.heading').each(($heading) => {
        const level = parseInt($heading.attr('level') || '1')
        if (level > 1) {
          const $parent = $heading.parents('.heading').first()
          if ($parent.length) {
            const parentLevel = parseInt($parent.attr('level') || '1')
            expect(parentLevel).to.be.lessThan(level)
          }
        }
      })

      cy.validateDomStructure({ throwOnError: true, logResults: true })
    })
  })
})
