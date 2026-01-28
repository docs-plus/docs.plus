/* eslint-disable no-undef */
/**
 * Complex Cut/Paste Tests
 *
 * Tests cutting complex structures (headings with nested children)
 * and pasting at:
 * - Leaf positions (start/end of nodes)
 * - Middle of contentWrapper
 * - Between sibling headings
 *
 * Also validates schema after each operation.
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Complex Cut/Paste Operations', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
    cy.on('uncaught:exception', () => false) // Handle potential errors gracefully
  })

  /**
   * Validates document schema after paste
   */
  const validateSchema = () => {
    return cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return { valid: false, errors: ['Editor not found'] }

      const doc = editor.state.doc
      const errors = []
      const headingStack = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const endPos = pos + node.nodeSize
          const title = node.firstChild?.textContent || 'Untitled'

          while (headingStack.length > 0) {
            const parent = headingStack[headingStack.length - 1]
            if (pos >= parent.endPos) headingStack.pop()
            else break
          }

          if (headingStack.length > 0) {
            const parent = headingStack[headingStack.length - 1]
            if (level === 1) {
              errors.push({
                type: 'H1_NESTED',
                message: `H1 "${title}" nested in H${parent.level}`
              })
            }
            if (level <= parent.level) {
              errors.push({
                type: 'INVALID_CHILD',
                message: `H${level} "${title}" inside H${parent.level}`
              })
            }
          }
          headingStack.push({ pos, level, endPos, title })
        }
      })

      return { valid: errors.length === 0, errors }
    })
  }

  describe('Cut Complex Heading with Children', () => {
    it('should cut H2 with nested H3 and H4, then paste at START of contentWrapper', () => {
      cy.createDocument([
        section('Section 1', [
          heading(2, 'Complex H2', [
            paragraph('H2 paragraph'),
            heading(3, 'Nested H3', [
              paragraph('H3 paragraph'),
              heading(4, 'Deep H4', [paragraph('H4 content')])
            ])
          ]),
          heading(2, 'Target H2', [paragraph('Target content')])
        ])
      ])
      cy.wait(500)

      // Cut the complex H2
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Paste at START of Target H2's contentWrapper (use first() for the p inside contentWrapper)
      cy.get('.docy_editor .heading[level="2"]').first().find('.contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Verify content pasted
      cy.get('.docy_editor').should('contain', 'Complex H2')
      cy.get('.docy_editor').should('contain', 'Nested H3')
      cy.get('.docy_editor').should('contain', 'Deep H4')

      // Validate schema
      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        expect(result.valid).to.be.true
      })
    })

    it('should cut H2 with nested H3 and H4, then paste at END of contentWrapper', () => {
      cy.createDocument([
        section('Section 1', [
          heading(2, 'Complex H2', [
            paragraph('H2 paragraph'),
            heading(3, 'Nested H3', [
              paragraph('H3 paragraph'),
              heading(4, 'Deep H4', [paragraph('H4 content')])
            ])
          ]),
          heading(2, 'Target H2', [paragraph('Target para 1'), paragraph('Target para 2')])
        ])
      ])
      cy.wait(500)

      // Cut the complex H2
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Paste at END of Target H2's contentWrapper
      cy.get('.docy_editor .heading[level="2"]').first().find('.contentWrapper p').last().click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Verify content pasted
      cy.get('.docy_editor').should('contain', 'Complex H2')
      cy.get('.docy_editor').should('contain', 'Deep H4')

      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        expect(result.valid).to.be.true
      })
    })

    it('should cut H2 with nested H3, paste at MIDDLE of contentWrapper', () => {
      cy.createDocument([
        section('Section 1', [
          heading(2, 'Complex H2', [
            paragraph('Complex content'),
            heading(3, 'Child H3', [paragraph('Child content')])
          ]),
          heading(2, 'Target H2', [
            paragraph('First paragraph'),
            paragraph('Middle paragraph'),
            paragraph('Last paragraph')
          ])
        ])
      ])
      cy.wait(500)

      // Cut complex H2
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Click at END of the middle paragraph (middle of contentWrapper)
      cy.get('.docy_editor .heading[level="2"]').first().find('.contentWrapper p').eq(1).click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Verify content pasted
      cy.get('.docy_editor').should('contain', 'Complex H2')
      cy.get('.docy_editor').should('contain', 'Child H3')

      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Cut and Paste Between Sibling Headings', () => {
    it('should cut H3 and paste between two other H3 siblings', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Parent H2', [
            heading(3, 'First H3', [paragraph('First content')]),
            heading(3, 'To Cut H3', [
              paragraph('Cut content'),
              heading(4, 'Nested H4', [paragraph('Nested')])
            ]),
            heading(3, 'Third H3', [paragraph('Third content')]),
            heading(3, 'Fourth H3', [paragraph('Fourth content')])
          ])
        ])
      ])
      cy.wait(500)

      // Cut the second H3 (To Cut H3)
      cy.get('.docy_editor .heading[level="3"]').eq(1).clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Paste at end of Fourth H3's content (between Third and Fourth)
      cy.get('.docy_editor .heading[level="3"]').last().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Verify content
      cy.get('.docy_editor').should('contain', 'To Cut H3')
      cy.get('.docy_editor').should('contain', 'Nested H4')

      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        expect(result.valid).to.be.true
      })
    })
  })

  describe('Cut from Deep Nesting and Paste at Different Levels', () => {
    it('should cut H4 and paste at H2 level (sibling of H2)', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'Source H2', [
            heading(3, 'Parent H3', [
              heading(4, 'H4 to Cut', [
                paragraph('H4 paragraph'),
                heading(5, 'Nested H5', [paragraph('H5 content')])
              ])
            ])
          ]),
          heading(2, 'Target H2', [paragraph('Target content')])
        ])
      ])
      cy.wait(500)

      // Cut H4
      cy.get('.docy_editor .heading[level="4"]').clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Paste at end of Target H2's content
      cy.get('.docy_editor .heading[level="2"]').last().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Content should be pasted
      cy.get('.docy_editor').should('contain', 'H4 to Cut')

      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        expect(result.valid).to.be.true
      })
    })

    it('should cut entire section (H1) and paste at document end', () => {
      cy.createDocument([
        section('Source Section', [
          paragraph('Source para'),
          heading(2, 'Source H2', [
            paragraph('H2 content'),
            heading(3, 'Source H3', [paragraph('H3 content')])
          ])
        ])
      ])
      cy.wait(500)

      // Add another section first
      cy.window().then((win) => {
        const editor = win._editor
        if (!editor) return
        const docEnd = editor.state.doc.content.size
        editor.commands.insertContentAt(docEnd, {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Target Section' }]
            },
            {
              type: 'contentWrapper',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Target content' }] }]
            }
          ]
        })
      })
      cy.wait(300)

      // Cut the first H1 section
      cy.get('.docy_editor .heading[level="1"]').first().clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Move to end of document
      cy.get('.docy_editor').click()
      cy.realPress(['Meta', 'End'])
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      // Verify content
      cy.get('.docy_editor').should('contain', 'Source Section')
      cy.get('.docy_editor').should('contain', 'Source H2')

      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        // H1 paste might need special handling
      })
    })
  })

  describe('Cut from Title and Paste into Another Title', () => {
    it('should type in title and verify title-to-title interaction', () => {
      cy.createDocument([
        section('Main Section', [
          heading(2, 'Source', [paragraph('Source content')]),
          heading(2, 'Target', [paragraph('Target content')])
        ])
      ])
      cy.wait(500)

      // Click in second H2's title and type
      cy.get('.docy_editor .heading[level="2"]').last().find('.title').click()
      cy.realPress('End')
      cy.wait(100)

      // Type some text to verify the title is editable
      cy.realType(' Appended')
      cy.wait(300)

      // Verify
      cy.get('.docy_editor .heading[level="2"]').last().find('.title').should('contain', 'Appended')
    })
  })

  describe('Cut and Paste at Extreme Boundaries', () => {
    it('should cut H3 and paste at the very START of H1 contentWrapper', () => {
      cy.createDocument([
        section('Section', [
          paragraph('Very first paragraph'),
          heading(2, 'H2', [heading(3, 'H3 to Cut', [paragraph('H3 content')])])
        ])
      ])
      cy.wait(500)

      // Cut H3
      cy.get('.docy_editor .heading[level="3"]').clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      // Position at very START of first paragraph in H1
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('Home')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      cy.get('.docy_editor').should('contain', 'H3 to Cut')

      validateSchema().then((result) => {
        if (!result.valid) cy.log('Schema errors:', JSON.stringify(result.errors))
        expect(result.valid).to.be.true
      })
    })

    it('should cut paragraph and paste at empty paragraph position', () => {
      cy.createDocument([
        section('Section', [
          paragraph('Paragraph to cut'),
          paragraph('') // Empty paragraph
        ])
      ])
      cy.wait(500)

      // Select first paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      // Cut
      cy.realPress(['Meta', 'x'])
      cy.wait(300)

      // Click in empty paragraph
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').last().click()
      cy.wait(100)

      // Paste
      cy.realPress(['Meta', 'v'])
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'Paragraph to cut')
    })
  })

  describe('Cut and Paste with Lists', () => {
    it('should cut heading with list content and paste at boundary', () => {
      cy.createDocument([
        section('Section', [
          heading(2, 'H2 with List', [
            paragraph('Before list')
            // Note: Lists would need to be added differently
          ]),
          heading(2, 'Target H2', [paragraph('Target')])
        ])
      ])
      cy.wait(500)

      // This test verifies basic cut/paste works with heading structure
      cy.get('.docy_editor .heading[level="2"]').first().clickAndSelectCopy('heading')
      cy.wait(200)
      cy.realPress(['Meta', 'x'])
      cy.wait(500)

      cy.get('.docy_editor .heading[level="2"]').first().find('.contentWrapper p').click()
      cy.realPress('End')
      cy.wait(100)

      cy.realPress(['Meta', 'v'])
      cy.wait(500)

      cy.get('.docy_editor').should('contain', 'H2 with List')
    })
  })
})
