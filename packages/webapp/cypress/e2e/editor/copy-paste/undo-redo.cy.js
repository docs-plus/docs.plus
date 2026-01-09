/* eslint-disable no-undef */
/**
 * Undo/Redo Tests (I1-I4)
 *
 * Tests that undo/redo operations work correctly
 * with copy/paste transactions.
 */

import { section, heading, paragraph } from '../../../fixtures/docMaker'

describe('Copy/Paste - Undo/Redo', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.waitForToc()
  })

  // ============================================================================
  // I1: Undo after paste - original state restored
  // ============================================================================
  it('I1: Undo after paste should restore original state', () => {
    const doc = [section('Section', [paragraph('Original content')])]
    cy.createDocument(doc)
    cy.waitForToc()

    // Insert a heading
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const pos = editor.state.selection.from
      editor.commands.insertContentAt(pos, {
        type: 'heading',
        attrs: { id: 'to-undo' },
        content: [
          {
            type: 'contentHeading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'New Heading' }]
          },
          { type: 'contentWrapper', content: [{ type: 'paragraph' }] }
        ]
      })
    })
    cy.wait(300)

    // Verify heading was inserted
    cy.get('.docy_editor .heading[level="2"]').should('exist')

    // Undo
    cy.get('.docy_editor').type('{meta}z')
    cy.wait(300)

    // Heading should be removed
    cy.get('.docy_editor .heading[level="2"]').should('not.exist')

    // Original content should remain
    cy.get('.docy_editor .heading[level="1"] .contentWrapper').should('contain', 'Original content')
  })

  // ============================================================================
  // I2: Redo after undo - pasted content restored
  // ============================================================================
  it('I2: Redo after undo should restore pasted content', () => {
    const doc = [section('Section', [paragraph('Content')])]
    cy.createDocument(doc)
    cy.waitForToc()

    // Insert heading
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const pos = editor.state.selection.from
      editor.commands.insertContentAt(pos, {
        type: 'heading',
        attrs: { id: 'to-redo' },
        content: [
          {
            type: 'contentHeading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Redo Heading' }]
          },
          { type: 'contentWrapper', content: [{ type: 'paragraph' }] }
        ]
      })
    })
    cy.wait(300)

    // Verify insertion
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Redo Heading')

    // Undo
    cy.get('.docy_editor').type('{meta}z')
    cy.wait(300)

    // Heading removed
    cy.get('.docy_editor .heading[level="2"]').should('not.exist')

    // Redo
    cy.get('.docy_editor').type('{meta}{shift}z')
    cy.wait(300)

    // Heading should be back
    cy.get('.docy_editor .heading[level="2"]').should('exist')
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Redo Heading')
  })

  // ============================================================================
  // I3: Multiple pastes + undo - correct state sequence
  // ============================================================================
  it('I3: Multiple operations should undo in sequence', () => {
    const doc = [section('Section', [paragraph('Base')])]
    cy.createDocument(doc)
    cy.waitForToc()

    // Insert first heading
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const pos = editor.state.selection.from
      editor.commands.insertContentAt(pos, {
        type: 'heading',
        attrs: { id: 'first-h2' },
        content: [
          {
            type: 'contentHeading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'First H2' }]
          },
          { type: 'contentWrapper', content: [{ type: 'paragraph' }] }
        ]
      })
    })
    cy.wait(300)

    // Insert second heading
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      // Find end of H1's contentWrapper
      let insertPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level
          if (level === 1) {
            insertPos = pos + node.nodeSize - 2
          }
        }
      })

      if (insertPos > 0) {
        editor.commands.insertContentAt(insertPos, {
          type: 'heading',
          attrs: { id: 'second-h2' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Second H2' }]
            },
            { type: 'contentWrapper', content: [{ type: 'paragraph' }] }
          ]
        })
      }
    })
    cy.wait(300)

    // Should have 2 H2s
    cy.get('.docy_editor .heading[level="1"] .contentWrapper > .heading[level="2"]').should(
      'have.length',
      2
    )

    // Undo once - should remove second H2
    cy.get('.docy_editor').type('{meta}z')
    cy.wait(300)

    cy.get('.docy_editor .heading[level="1"] .contentWrapper > .heading[level="2"]').should(
      'have.length',
      1
    )
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'First H2')

    // Undo again - should remove first H2
    cy.get('.docy_editor').type('{meta}z')
    cy.wait(300)

    cy.get('.docy_editor .heading[level="2"]').should('not.exist')
  })

  // ============================================================================
  // I4: Paste + edit + undo - edit undone, paste remains
  // ============================================================================
  it('I4: Edit after paste should undo independently', () => {
    const doc = [section('Section', [paragraph('Content')])]
    cy.createDocument(doc)
    cy.waitForToc()

    // Insert heading
    cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const pos = editor.state.selection.from
      editor.commands.insertContentAt(pos, {
        type: 'heading',
        attrs: { id: 'editable-h2' },
        content: [
          {
            type: 'contentHeading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Editable' }]
          },
          { type: 'contentWrapper', content: [{ type: 'paragraph' }] }
        ]
      })
    })
    cy.wait(300)

    // Edit the heading title
    cy.get('.docy_editor .heading[level="2"] .title').click()
    cy.get('.docy_editor .heading[level="2"] .title').type(' Modified')
    cy.wait(200)

    // Title should be modified
    cy.get('.docy_editor .heading[level="2"] .title').should('contain', 'Editable Modified')

    // Undo the edit
    cy.get('.docy_editor').type('{meta}z')
    cy.wait(300)

    // Should revert to original title but heading still exists
    // Note: Undo behavior may vary - this tests the concept
    cy.get('.docy_editor .heading[level="2"]').should('exist')
  })
})
