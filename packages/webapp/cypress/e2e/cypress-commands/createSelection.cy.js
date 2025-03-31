// Helper functions for creating DOM elements
function createHeading(win, level, title) {
  const heading = win.document.createElement('div')
  heading.className = 'heading opend'
  heading.setAttribute('level', level.toString())
  heading.setAttribute('data-id', `heading-${Math.random().toString(36).substr(2, 9)}`)
  heading.setAttribute('data-type', 'heading')

  const wrapBlock = win.document.createElement('div')
  wrapBlock.className = 'wrapBlock'
  wrapBlock.setAttribute('data-id', heading.getAttribute('data-id') || '')

  const titleElem = win.document.createElement(`h${level}`)
  titleElem.className = 'title'
  titleElem.setAttribute('level', level.toString())
  titleElem.innerHTML = `<span>${title}</span>`

  wrapBlock.appendChild(titleElem)
  heading.appendChild(wrapBlock)

  return heading
}

const STATIC_ADDRESS = '/cypress/fixtures/cypress-commands/createSelection'

describe('Document Structure Validation', () => {
  it('validates a properly structured document', () => {
    // Create the document
    cy.visit(`${STATIC_ADDRESS}/standard-nested-headings-document.html`)

    // Validate structure - should pass
    cy.validateDomStructure().then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors.length).to.equal(0)
    })
  })

  it('validates a complex document with multiple heading levels', () => {
    // Create the document
    cy.visit(`${STATIC_ADDRESS}/multi-level-headings-document.html`)

    // Validate structure
    cy.validateDomStructure().then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors.length).to.equal(0)
    })
  })

  it('detects invalid document structure', () => {
    // Create a document with invalid structure programmatically
    // We can't use createDocument() directly since it enforces valid structure
    // So we'll create a valid document and then modify the DOM

    cy.visit(`${STATIC_ADDRESS}/basic-single-section-document.html`)

    // Now manipulate the DOM to create an invalid structure
    cy.window().then((win) => {
      // Get the editor element
      const editor = win.document.querySelector('.docy_editor > .tiptap.ProseMirror')

      if (!editor) {
        throw new Error('Editor element not found')
      }

      // Find the first section
      const section = editor.querySelector('.heading[level="1"]')
      if (!section) {
        throw new Error('Section not found')
      }

      // Find the content wrapper of the section
      const contentWrapper = section.querySelector('.contentWrapper')
      if (!contentWrapper) {
        throw new Error('Content wrapper not found')
      }

      const contents = contentWrapper.querySelector('.contents')
      if (!contents) {
        throw new Error('Contents not found')
      }

      // Create an invalid nested section (level 1 inside level 1)
      const invalidSection = createHeading(win, 1, 'Invalid Nested Section')

      // Append the invalid section to the contents
      contents.appendChild(invalidSection)
    })

    // Validate structure - should fail
    cy.validateDomStructure({ throwOnError: false }).then((result) => {
      expect(result.valid).to.be.false
      expect(result.errors.length).to.be.at.least(1)
    })
  })

  it('detects invalid heading hierarchy', () => {
    // Create a document with invalid heading hierarchy
    // We'll create a valid document first, then modify the DOM

    cy.visit(`${STATIC_ADDRESS}/basic-two-level-document.html`)

    // Now manipulate the DOM to create an invalid hierarchy
    cy.window().then((win) => {
      // Get the editor element
      const editor = win.document.querySelector('.docy_editor > .tiptap.ProseMirror')

      if (!editor) {
        throw new Error('Editor element not found')
      }

      // Find the level 2 heading
      const level2Heading = editor.querySelector('.heading[level="2"]')
      if (!level2Heading) {
        throw new Error('Level 2 heading not found')
      }

      // Find the content wrapper of the level 2 heading
      const contentWrapper = level2Heading.querySelector('.contentWrapper')
      if (!contentWrapper) {
        throw new Error('Content wrapper not found')
      }

      const contents = contentWrapper.querySelector('.contents')
      if (!contents) {
        throw new Error('Contents not found')
      }

      // Create an invalid heading (level 1, which should not be nested)
      const invalidHeading1 = createHeading(win, 1, 'Invalid Level 1')

      // Create another invalid heading (level 1, which should not be a child of level 2)
      const invalidHeading2 = createHeading(win, 1, 'Another Invalid Level 1')

      // Append the invalid headings to the contents
      contents.appendChild(invalidHeading1)
      contents.appendChild(invalidHeading2)
    })

    cy.wait(1000)

    // Validate hierarchy - should fail
    cy.validateDomStructure({ throwOnError: false }).then((result) => {
      expect(result.valid).to.be.false
      expect(result.errors.length).to.be.at.least(1)
    })
  })

  it('tests selection across different elements', () => {
    // Create the document
    cy.visit(`${STATIC_ADDRESS}/mixed-content-selection-document.html`)

    // Test selection from paragraph to heading
    cy.createSelection({
      startSection: { title: 'Selection Test' },
      startParagraph: { text: 'first paragraph for selection' },
      startPosition: 12, // After "This is the "
      endHeading: { level: 2, title: 'Level 2 Heading' },
      endParagraph: { text: 'First ordered item' },
      endPosition: 5
    }).then(({ startElement, endElement }) => {
      // Verify the selection
      cy.window().then((win) => {
        const selection = win.getSelection()

        if (!selection) {
          throw new Error('No selection found')
        }

        expect(selection.rangeCount).to.equal(1)

        // Verify the selection contents
        const selectedText = selection.toString()

        expect(selectedText).to.include('paragraph for selection testing')
        expect(selectedText).to.include('Level 2 Heading')
        expect(selectedText).to.include('Third bullet point')
        expect(selectedText).to.not.include('ordered item')
      })
    })

    // Test selection from one heading to another
    // endheaindg, start, it mean select the leaf of the level 3 heading
    cy.createSelection({
      startHeading: { level: 2, title: 'Level 2 Heading' },
      startPosition: 'start',
      endHeading: { level: 3, title: 'Level 3 Heading' },
      endPosition: 'start'
    }).then(({ startElement, endElement }) => {
      cy.window().then((win) => {
        const selection = win.getSelection()

        if (!selection) {
          throw new Error('No selection found')
        }

        const selectedText = selection.toString()
        const focusNode = selection.focusNode

        expect(selectedText).to.include('Level 2 Heading')
        expect(selectedText).to.not.include('Level 3 Heading')
        // NOTE: it work in the real dom but in here not work
        // expect(focusNode.textContent).to.include('Level 3 Heading')
      })
    })
  })

  it('tests selection by index position', () => {
    cy.visit(`${STATIC_ADDRESS}/index-based-selection-document.html`)

    // Select from 2nd paragraph to 1st heading's 1st paragraph
    cy.createSelection({
      startSection: { title: 'Selection By Index' },
      startParagraph: 2, // Second paragraph (1-based index)
      startPosition: 8, // After "This is "
      endHeading: { level: 2, title: 'Heading One' },
      endParagraph: 1, // First paragraph under the heading
      endPosition: 'end'
    }).then(({ startElement, endElement }) => {
      cy.window().then((win) => {
        const selection = win.getSelection()

        if (!selection) {
          throw new Error('No selection found')
        }

        const selectedText = selection.toString()
        expect(selectedText).to.include('paragraph two')
        expect(selectedText).to.include('This is paragraph three')
        expect(selectedText).to.include('Heading One')
        expect(selectedText).to.include('Content under heading one')

        expect(selection.anchorOffset).to.equal(8)
      })
    })
  })

  it('tests selection within list items', () => {
    cy.visit(`${STATIC_ADDRESS}/list-selection-test-document.html`)

    // Select from second bullet item to second ordered item
    cy.createSelection({
      startSection: { title: 'List Selection Test' },
      startParagraph: { text: 'Second bullet item' },
      startPosition: 4,
      endParagraph: { text: 'Second ordered item' },
      endPosition: 'end'
    }).then(() => {
      cy.window().then((win) => {
        const selection = win.getSelection()
        if (!selection) throw new Error('No selection found')

        const selectedText = selection.toString()
        expect(selectedText).to.include('nd bullet item')
        expect(selectedText).to.include('Third bullet item')
        expect(selectedText).to.include('Paragraph between lists')
        expect(selectedText).to.include('First ordered item')
        expect(selectedText).to.include('Second ordered item')

        expect(selection.anchorOffset).to.equal(4)
      })
    })
  })

  it('validates a document with non-sequential heading levels', () => {
    cy.visit(`${STATIC_ADDRESS}/non-sequential-headings-document.html`)

    // This should still be valid because jumps are allowed
    // as long as children have higher levels than parents
    cy.validateDomStructure().then((result) => {
      expect(result.valid).to.be.true
      expect(result.errors.length).to.equal(0)
    })

    // Try selecting content across the jump
    cy.createSelection({
      startHeading: { level: 4, title: 'Level 4 Heading' },
      startPosition: 'start',
      endSection: { title: 'Another Section' },
      endHeading: { level: 5, title: 'Level 5 Heading' },
      endPosition: 'start'
    }).then(() => {
      cy.window().then((win) => {
        const selection = win.getSelection()
        if (!selection) throw new Error('No selection found')

        const selectedText = selection.toString()
        expect(selectedText).to.include('Level 4 Heading')
        expect(selectedText).to.include('Level 7 Heading')
        expect(selectedText).to.include('Level 3 Heading')
        expect(selectedText).to.include('Another Section')
        expect(selectedText).to.not.include('Level 5 Heading')

        // mean the selection is at the start of the level 5 heading
        expect(selection.anchorOffset).to.equal(0)
      })
    })
  })
})
