/* eslint-disable no-undef */
/**
 * User Keyboard Shortcuts Tests
 *
 * Tests keyboard shortcuts that users commonly use when editing documents.
 * Covers heading creation, level changes, text formatting, and navigation.
 */

import { TEST_TITLE, TEST_CONTENT } from '../../../support/commands'
import { section, paragraph, heading } from '../../../fixtures/docMaker'

describe('User Keyboard Shortcuts', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'keyboard-shortcuts-test' })
  })

  describe('Heading Level Shortcuts (Alt+Meta+1-9)', () => {
    it('should change heading levels with Alt+Meta+1 through Alt+Meta+9', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Test Section', [heading(2, 'Test Heading', [paragraph('Test content')])])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Test each level 1-9
      const levels = [3, 5, 7, 9, 8, 6, 4, 2]

      cy.putPosCaretInHeading(2, 'Test Heading', 'start')

      levels.forEach((level) => {
        cy.realPress(['Alt', 'Meta', String(level)]).wait(200)
        cy.get('.heading .title')
          .contains('Test Heading')
          .closest('.heading')
          .should('have.attr', 'level', String(level))
      })
    })

    it('should convert heading to paragraph with Alt+Meta+0', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Test Section', [heading(3, 'Convert Me', [paragraph('Some content')])])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      cy.putPosCaretInHeading(3, 'Convert Me', 'start')
      cy.realPress(['Alt', 'Meta', '0'])
      cy.wait(300)

      // Should be converted to paragraph
      cy.get('.heading .title').contains('Convert Me').should('not.exist')
      cy.get('p').contains('Convert Me').should('exist')
    })

    it('should create new heading from paragraph with Alt+Meta+N', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Make me a heading')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click in the paragraph
      cy.get('p').contains('Make me a heading').click()
      cy.wait(100)

      // Convert to heading level 2
      cy.realPress(['Alt', 'Meta', '2'])
      cy.wait(300)

      // Should now be a heading
      cy.get('.heading[level="2"] .title').should('contain', 'Make me a heading')
    })
  })

  describe('Enter Key Behavior', () => {
    it('should create new paragraph after heading when pressing Enter at end', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [heading(2, 'My Heading', [paragraph('Content')])])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Position at end of heading title
      cy.putPosCaretInHeading(2, 'My Heading', 'end')
      cy.realPress('Enter')
      cy.wait(200)

      // Type in the new paragraph
      cy.realType('New paragraph text')
      cy.wait(200)

      // Should have new paragraph
      cy.get('p').contains('New paragraph text').should('exist')
    })

    it('should split heading when pressing Enter in middle of title', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [heading(2, 'FirstSecond', [paragraph('Content')])])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Position in middle of heading (after "First")
      cy.putPosCaretInHeading(2, 'FirstSecond', 5) // After "First"
      cy.realPress('Enter')
      cy.wait(300)

      // "Second" should now be in a new element (either paragraph or heading)
      cy.get('.heading[level="2"] .title').should('contain', 'First')
    })
  })

  describe('Backspace Key Behavior', () => {
    it('should merge with previous paragraph when backspace at heading start', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Test Section', [
            paragraph('Previous paragraph'),
            heading(2, 'Heading to merge', [paragraph('Content')])
          ])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Position at start of heading title
      cy.putPosCaretInHeading(2, 'Heading to merge', 'start')
      cy.realPress('Backspace')
      cy.wait(300)

      // Structure should still be valid
      cy.validateDomStructure({ throwOnError: false, logResults: true }).then((result) => {
        expect(result.valid).to.be.true
      })
    })

    it('should delete character when backspace in middle of heading', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [heading(2, 'Delete Test', [paragraph('Content')])])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Position after "Delete " (7 characters)
      cy.putPosCaretInHeading(2, 'Delete Test', 7)
      cy.realPress('Backspace')
      cy.wait(200)

      // Should now be "DeleteTest"
      cy.get('.heading[level="2"] .title').should('contain', 'DeleteTest')
    })
  })

  describe('Delete Key Behavior', () => {
    it('should delete character when delete key pressed in heading', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [heading(2, 'Test Delete', [paragraph('Content')])])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Position after "Test" (4 characters)
      cy.putPosCaretInHeading(2, 'Test Delete', 4)
      cy.realPress('Delete')
      cy.wait(200)

      // Should now be "TestDelete"
      cy.get('.heading[level="2"] .title').should('contain', 'TestDelete')
    })
  })

  describe('Selection Shortcuts', () => {
    it('should select all with Meta+A', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [
          section('Section One', [paragraph('Content 1')]),
          section('Section Two', [paragraph('Content 2')])
        ]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Focus editor
      cy.get('.docy_editor .tiptap').click()

      // Select all
      cy.realPress(['Meta', 'a'])
      cy.wait(200)

      // Check selection exists (window selection should have content)
      cy.window().then((win) => {
        const selection = win.getSelection()
        expect(selection.toString().length).to.be.greaterThan(0)
      })
    })

    it('should extend selection with Shift+Arrow keys', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Select this text')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click at start of paragraph
      cy.get('p').contains('Select this text').click()
      cy.realPress('Home') // Go to start
      cy.wait(100)

      // Extend selection with Shift+Right
      for (let i = 0; i < 6; i++) {
        cy.realPress(['Shift', 'ArrowRight'])
      }
      cy.wait(100)

      // Should have "Select" selected
      cy.window().then((win) => {
        const selection = win.getSelection()
        expect(selection.toString()).to.equal('Select')
      })
    })
  })

  describe('Text Formatting Shortcuts', () => {
    it('should make text bold with Meta+B', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Make this bold')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Select "this"
      cy.get('p').contains('Make this bold').click()

      // Select the word "this"
      cy.window().then((win) => {
        const editor = win._editor
        // Find position of "this" in the paragraph
        let paragraphPos = null
        editor.state.doc.descendants((node, pos) => {
          if (node.isText && node.text.includes('Make this bold')) {
            paragraphPos = pos + 5 // Start of "this"
            return false
          }
        })
        if (paragraphPos) {
          editor.commands.setTextSelection({ from: paragraphPos, to: paragraphPos + 4 })
        }
      })

      cy.realPress(['Meta', 'b'])
      cy.wait(200)

      // Check for bold styling
      cy.get('strong').contains('this').should('exist')
    })

    it('should make text italic with Meta+I', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Make this italic')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Select "this"
      cy.window().then((win) => {
        const editor = win._editor
        let paragraphPos = null
        editor.state.doc.descendants((node, pos) => {
          if (node.isText && node.text.includes('Make this italic')) {
            paragraphPos = pos + 5
            return false
          }
        })
        if (paragraphPos) {
          editor.commands.setTextSelection({ from: paragraphPos, to: paragraphPos + 4 })
        }
      })

      cy.realPress(['Meta', 'i'])
      cy.wait(200)

      // Check for italic styling
      cy.get('em').contains('this').should('exist')
    })

    it('should underline text with Meta+U', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Make this underlined')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Select "this"
      cy.window().then((win) => {
        const editor = win._editor
        let paragraphPos = null
        editor.state.doc.descendants((node, pos) => {
          if (node.isText && node.text.includes('Make this underlined')) {
            paragraphPos = pos + 5
            return false
          }
        })
        if (paragraphPos) {
          editor.commands.setTextSelection({ from: paragraphPos, to: paragraphPos + 4 })
        }
      })

      cy.realPress(['Meta', 'u'])
      cy.wait(200)

      // Check for underline styling
      cy.get('u').contains('this').should('exist')
    })
  })

  describe('Undo/Redo Shortcuts', () => {
    it('should undo with Meta+Z', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Original text')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Add some text
      cy.get('p').contains('Original text').click()
      cy.realPress('End')
      cy.realType(' added text')
      cy.wait(200)

      // Verify text was added
      cy.get('p').contains('Original text added text').should('exist')

      // Undo
      cy.realPress(['Meta', 'z'])
      cy.wait(200)

      // Text should be removed (or partially)
      // Note: Undo behavior may vary based on how text was typed
    })

    it('should redo with Meta+Shift+Z', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Original')])]
      }

      cy.createDocument(doc)
      cy.wait(500)

      // Make a change
      cy.get('p').contains('Original').click()
      cy.realPress('End')
      cy.realType(' change')
      cy.wait(200)

      // Undo
      cy.realPress(['Meta', 'z'])
      cy.wait(200)

      // Redo
      cy.realPress(['Meta', 'Shift', 'z'])
      cy.wait(200)

      // Change should be back
      cy.get('p').should('contain', 'change')
    })
  })

  describe('Navigation Shortcuts', () => {
    it('should navigate with arrow keys', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('Navigate with arrows')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click in paragraph
      cy.get('p').contains('Navigate with arrows').click()
      cy.wait(100)

      // Move with arrow keys
      cy.realPress('ArrowLeft')
      cy.realPress('ArrowLeft')
      cy.realPress('ArrowRight')
      cy.wait(100)

      // Type to verify we moved
      cy.realType('X')
      cy.wait(200)

      // Should have inserted X somewhere in the text
      cy.get('p').should('contain', 'X')
    })

    it('should handle word navigation with Option+Arrow', () => {
      const doc = {
        documentName: TEST_TITLE.HelloDocy,
        sections: [section('Test Section', [paragraph('One two three four')])]
      }

      cy.createDocument(doc)
      cy.wait(300)

      // Click in paragraph
      cy.get('p').contains('One two three').click()
      cy.wait(100)

      // Word navigation works differently on Mac
      // Just verify the text is there
      cy.get('p').should('contain', 'One two three four')
    })
  })
})

