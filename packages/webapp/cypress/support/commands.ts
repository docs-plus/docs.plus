// @ts-nocheck
import { BulletList } from '@tiptap/extension-list'
import cypress from 'cypress'
/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

// Add this type and constant at the top level
type TestContent = {
  short: string
  medium: string
  long: string
}

export const TEST_CONTENT: TestContent = {
  short: `This is a brief test content for basic testing scenarios.`,
  medium: `This is a medium-length test content. It contains multiple sentences that can be used for more detailed testing. This content helps validate multi-line scenarios.`,
  long: `This is a comprehensive test content designed for extensive testing. It contains multiple paragraphs and varied content. This section helps test how the editor handles longer content blocks. It includes different sentence lengths and structures. This makes it useful for testing text rendering and formatting capabilities.`,
  empty: ` `
}

export const TEST_TITLE = {
  HelloDocy: 'Hello Docsplus World!',
  short: 'Short Title',
  medium: 'Medium Title',
  long: 'This is an Extra Long Title for Testing Overflow Scenarios',
  withSpecialChars: 'Title with @#$% Special Characters!',
  numbers: 'Title 123 with Numbers 456',
  emoji: '📝 Title with Emoji 🚀',
  unicode: 'Title with Unicode Characters: é ñ ü ß',
  spaces: '   Title   with   Extra   Spaces   ',
  markdown: '**Bold** _Italic_ `Code` Title',
  empty: '',
  singleChar: 'A',
  maxLength:
    'This is a Very Long Title That Should Test the Maximum Length Limits of the Title Field in Various Scenarios'
}

// Add this helper function at the top level
function generatePredictableText(sentenceCount: number): string {
  const generateSentence = (index: number) =>
    `This is test sentence number ${index + 1} with predictable content.`

  return Array.from({ length: sentenceCount }, (_, i) => generateSentence(i)).join(' ')
}

// Import and register document structure validator
import { registerDocumentValidator } from '../fixtures/docTestHelper'
registerDocumentValidator()

// Define the SelectionLevel type if it's not already defined
type SelectionLevel = 'element' | 'parent' | 'section' | 'heading' | 'list' | 'document'

declare global {
  namespace Cypress {
    interface Chainable {
      clearEditor(title?: string, sentencesCount?: number): Chainable<Element>
      createHeading(
        title: string,
        headingLevel: number,
        sentencesCount?: number
      ): Chainable<Element>
      enter(times?: number): Chainable<Element>
      getEditor(): Chainable<Element>
      createDocument(doc: any): Chainable<Element>
      createOrderedList(items: any)
      createBulletList(items: any)
      createIndentHeading(content: {
        level: number
        title: string
        contents: Array<{
          type: 'paragraph' | 'orderedList' | 'bulletList' | 'heading'
          content?: string
          contents?: any[]
        }>
      }): Chainable<Element>
      visitEditor(options: { persist?: boolean; docName: string }): Chainable<Element>

      /**
       * Validates document structure follows proper heading level hierarchy rules
       * @param documentStructure - The document structure to validate
       * @param options - Validation options
       * @example cy.validateDocumentStructure(myDocStructure, { throwOnError: true })
       */
      validateDocumentStructure(
        documentStructure: any,
        options?: {
          throwOnError?: boolean
          logResults?: boolean
          verbose?: boolean
        }
      ): Chainable<{ valid: boolean; error?: string }>
      clearInlineNode(): Chainable<Element>
      writeToClipboard(text: string): Chainable<Element>
      readFromClipboard(): Chainable<Element>
      copySelectionToClipboard(): Chainable<Element>
      pasteClipboardHtml(): Chainable<Element>

      /**
       * Selects content at the specified hierarchical level starting from the clicked element
       * @param level - The hierarchical level to select
       * @example cy.get('.heading[level="2"]').clickAndSelect('heading')
       */
      clickAndSelect(level: SelectionLevel): Chainable<Element>

      /**
       * Selects content at the specified hierarchical level and copies it to clipboard
       * @param level - The hierarchical level to select and copy
       * @example cy.get('.heading[level="2"]').clickAndSelectCopy('heading')
       */
      clickAndSelectCopy(level: SelectionLevel): Chainable<Element>

      /**
       * Applies a heading level change to the specified heading text
       * @param headingText - The text of the heading to change
       * @param currentLevel - The current level of the heading
       * @param newLevel - The new level to apply
       * @example cy.applyHeadingLevelChange('Heading Text', 2, 3)
       */
      applyHeadingLevelChange(
        headingText: string,
        currentLevel: number,
        newLevel: number
      ): Chainable<Element>

      /**
       * Validates a heading level change
       * @param headingText - The text of the heading to validate
       * @param currentLevel - The current level of the heading
       * @param newLevel - The new level to validate
       * @example cy.validateHeadingLevelChange('Heading Text', 2, 3)
       */
      validateHeadingLevelChange(
        headingText: string,
        currentLevel: number,
        newLevel: number
      ): Chainable<Element>

      /**
       * Validates the DOM structure according to editor schema rules
       * - Level 1 headings (sections) cannot be nested inside each other
       * - Headings range from level 2-10 and must be nested inside a section
       * - Heading hierarchy must be maintained (child level > parent level)
       */
      validateDomStructure(options?: {
        throwOnError: boolean
        logResults: boolean
      }): Chainable<{ valid: boolean; errors: string[]; structure: any[] }>

      createSelection(options: {
        editorSelector?: string
        startSection?: string | number | { title: string }
        startHeading?: string | number | { level: number; title: string }
        startParagraph?: string | number | { text: string }
        startPosition?: 'start' | 'end' | number
        endSection?: string | number | { title: string }
        endHeading?: string | number | { level: number; title: string }
        endParagraph?: string | number | { text: string }
        endPosition?: 'start' | 'end' | number
      }): Chainable<{ startElement: Element; endElement: Element; range: Range }>

      createParagraph(
        content: string | string[] | Array<{ text: string; style?: Record<string, any> }>
      ): Chainable<Element>

      createSection(section: {
        title: string
        contents?: Array<{
          type: 'paragraph' | 'orderedList' | 'bulletList' | 'heading'
          content?: any
        }>
        isFirst?: boolean
      }): Chainable<Element>
    }
  }
}

Cypress.Commands.add('clearInlineNode', () => {
  // Select all text (move to start and select to end)
  cy.get('.docy_editor > .tiptap.ProseMirror').realPress('Home')
  cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Shift', 'End'])
})

Cypress.Commands.add('createOrderedList', (items) => {
  if (!items.length) return

  cy.get('.docy_editor > .tiptap.ProseMirror')
    .type(items[0].text)
    .realPress(['Shift', 'Meta', '7']) // Create ordered list
    .realPress(['Enter'])

  let currentIndent = 0
  // Start from index 1 since we've already handled the first item
  items.slice(1).forEach((item, index, array) => {
    const targetIndent = item.indent || 0
    const indentDiff = targetIndent - currentIndent

    // Handle indentation/outdentation
    if (indentDiff > 0) {
      // Indent: press Tab for each level
      for (let i = 0; i < indentDiff; i++) {
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Tab'])
      }
    } else if (indentDiff < 0) {
      // Outdent: press Shift+Tab for each level
      for (let i = 0; i < Math.abs(indentDiff); i++) {
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Shift', 'Tab'])
      }
    }

    // Only press Enter if it's not the last item
    const isLastItem = index === array.length - 1
    cy.get('.docy_editor > .tiptap.ProseMirror')
      .type(item.text)
      .then(() => {
        if (!isLastItem) {
          cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Enter'])
        } else {
          // Calculate number of enters based on indent level to exit the ordered list
          const enterCount = targetIndent === 0 ? 2 : targetIndent + 2
          cy.enter(enterCount)
        }
      })

    currentIndent = targetIndent
  })
})

Cypress.Commands.add('createBulletList', (items) => {
  if (!items.length) return

  cy.get('.docy_editor > .tiptap.ProseMirror')
    .type(items[0].text)
    .realPress(['Shift', 'Meta', '8']) // Create bullet list
    .realPress(['Enter'])

  let currentIndent = 0
  // Start from index 1 since we've already handled the first item
  items.slice(1).forEach((item, index, array) => {
    const targetIndent = item.indent || 0
    const indentDiff = targetIndent - currentIndent

    // Handle indentation/outdentation
    if (indentDiff > 0) {
      // Indent: press Tab for each level
      for (let i = 0; i < indentDiff; i++) {
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Tab'])
      }
    } else if (indentDiff < 0) {
      // Outdent: press Shift+Tab for each level
      for (let i = 0; i < Math.abs(indentDiff); i++) {
        cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Shift', 'Tab'])
      }
    }

    // Only press Enter if it's not the last item
    const isLastItem = index === array.length - 1
    cy.get('.docy_editor > .tiptap.ProseMirror')
      .type(item.text)
      .then(() => {
        if (!isLastItem) {
          cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Enter'])
        } else {
          // Calculate number of enters based on indent level to exit the bullet list
          const enterCount = targetIndent === 0 ? 2 : targetIndent + 2
          cy.enter(enterCount)
        }
      })

    currentIndent = targetIndent
  })
})

Cypress.Commands.add('createIndentHeading', (content) => {
  const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
  const { level, title, contents } = content

  editor
    .type(title)
    .realPress(['Alt', 'Meta', String(level)])
    .realPress('Enter')

  // Skip content processing if contents array is empty or undefined
  if (!contents || contents.length === 0) return

  for (const content of contents) {
    switch (content?.type) {
      case 'paragraph':
        cy.createParagraph(content.content)
        break
      case 'orderedList':
        cy.createOrderedList(content.content)
        break
      case 'bulletList':
        cy.createBulletList(content.content)
        break
      case 'heading':
        cy.createIndentHeading(content)
        break
    }
  }
})

Cypress.Commands.add('createDocument', (doc) => {
  const documentTitle = doc.documentName
  const sections = doc.sections

  // Initialize document with title
  const editor = cy
    .get('.docy_editor > .tiptap.ProseMirror')
    .click({ force: true })
    .realPress(['Meta', 'a', 'Backspace'])

  // Process each section
  for (const [index, section] of sections.entries()) {
    cy.createSection({
      title: section.title,
      contents: section.contents ?? [], // Use nullish coalescing for default empty array
      isFirst: index === 0
    })
  }
})

Cypress.Commands.add('createSection', (section) => {
  const { title, contents = [], isFirst = false } = section
  const editor = cy.get('.docy_editor > .tiptap.ProseMirror')

  // Create the section title
  if (isFirst) {
    // First section is created by just typing the title
    editor.type(title).realPress('Enter')
  } else {
    // Subsequent sections need Alt+Meta+1 shortcut
    editor.type(title).realPress(['Alt', 'Meta', '1']).realPress('Enter')
  }

  // Process each content item in the section
  for (const content of contents) {
    switch (content?.type) {
      case 'paragraph':
        cy.createParagraph(content.content)
        break

      case 'orderedList':
        cy.createOrderedList(content.content)
        break

      case 'bulletList':
        cy.createBulletList(content.content)
        break

      case 'heading':
        cy.createIndentHeading(content)
        break
    }
  }
})

Cypress.Commands.add('createParagraph', (content) => {
  const editor = cy.get('.docy_editor > .tiptap.ProseMirror')

  if (!content) return

  // Handle both string and array inputs
  if (typeof content === 'string') {
    // For simple string paragraphs
    editor.type(content).realPress('Enter')
  } else if (Array.isArray(content)) {
    // For multiple paragraphs or more complex paragraph objects
    content.forEach((item, index) => {
      const text = typeof item === 'string' ? item : item.text

      editor.type(text)

      // Apply styles if specified
      if (typeof item === 'object' && item.style) {
        // Apply each style
        Object.entries(item.style).forEach(([style, value]) => {
          switch (style) {
            case 'bold':
              if (value) editor.realPress(['Meta', 'b'])
              break
            case 'italic':
              if (value) editor.realPress(['Meta', 'i'])
              break
            case 'underline':
              if (value) editor.realPress(['Meta', 'u'])
              break
            // Add more style handlers as needed
          }
        })
      }

      // Only press Enter if it's not the last paragraph
      if (index < content.length - 1) {
        editor.realPress('Enter')
      }
    })

    // Add an extra Enter at the end to move to the next content block
    editor.realPress('Enter')
  }
})

Cypress.Commands.add('Document', (title, content) => {
  const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
  editor.click().type('{selectall}{del}', { release: false })
  editor.type(title).type('{enter}').type(TEST_CONTENT.short)
})

Cypress.Commands.add('createHeading', (title: string, headingLevel = 2, sentencesCount) => {
  const editor = cy
  get('.docy_editor > .tiptap.ProseMirror')
    .type(`${title}`)
    .realPress(['Alt', 'Meta', String(headingLevel) as KeyOrShortcut])
  if (sentencesCount) {
    editor.type(generatePredictableText(sentencesCount))
  }
})

Cypress.Commands.add('enter', (times = 1) => {
  for (let i = 0; i < times; i++) {
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Enter'])
  }
})

Cypress.Commands.add('getEditor', () => {
  return cy.window().then((win) => win._editor)
})

Cypress.Commands.add('visitEditor', ({ persist = false, docName, clearDoc = false } = {}) => {
  if (persist && docName) {
    cy.visit(`http://localhost:3000/editor?localPersistence=${persist}&docName=${docName}`)
  } else {
    cy.visit(`http://localhost:3000/editor`)
  }
  cy.get('.docy_editor > .tiptap.ProseMirror').should('be.visible')
  if (clearDoc) {
    cy.get('.docy_editor > .tiptap.ProseMirror')
      .click()
      .realPress(['Meta', 'a', 'Backspace'])
      .wait(100)
  }
})

Cypress.Commands.add('copySelectionToClipboard', { prevSubject: 'element' }, ($element) => {
  const doc = $element[0].ownerDocument
  const selection = doc.getSelection()
  const range = selection.rangeCount ? selection.getRangeAt(0) : null

  if (!range || selection.isCollapsed) {
    throw new Error('No content selected to copy.')
  }

  const fragment = range.cloneContents()
  const div = doc.createElement('div')
  div.appendChild(fragment)
  const html = div.innerHTML

  return cy.window().then((win) => {
    const clipboardItem = new win.ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' })
    })

    return win.navigator.clipboard.write([clipboardItem])
  })
})

Cypress.Commands.add('pasteClipboardHtml', { prevSubject: 'element' }, ($element) => {
  cy.window().then((win) => {
    return win.navigator.clipboard.read().then(async (items) => {
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          const html = await blob.text()

          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            bubbles: true,
            cancelable: true
          })

          pasteEvent.clipboardData.setData('text/html', html)
          $element[0].dispatchEvent(pasteEvent)
          return
        }
      }
      throw new Error('No HTML content found in clipboard.')
    })
  })
})

Cypress.Commands.add('putPosCaretInHeading', (level, headingText, position = 'end') => {
  return cy.window().then((win) => {
    // Get the Tiptap editor instance
    const editor = win._editor

    if (!editor) {
      throw new Error(
        'Tiptap editor not found. Make sure it is initialized and accessible as window._editor'
      )
    }

    // Find the heading node in the Tiptap document
    let headingFound = false
    let headingPos = 0
    let headingNode = null

    editor.state.doc.descendants((node, pos) => {
      if (headingFound) return false // Skip if already found

      // in real world, user can not put caret in heading node pos, the caret will be place in contentheading node pos
      if (
        node.type.name === 'contentHeading' &&
        node.attrs.level === level &&
        node.textContent.includes(headingText)
      ) {
        headingFound = true
        headingPos = pos
        headingNode = node
        return false // Stop traversal
      }
    })

    if (!headingFound || !headingNode) {
      throw new Error(`Heading level ${level} with text "${headingText}" not found in the document`)
    }

    // Calculate the position for the cursor
    let targetPos = headingPos + 1 // Default to start of heading content

    if (position === 'end') {
      targetPos = headingPos + headingNode.nodeSize - 1
    } else if (typeof position === 'number') {
      if (position >= 0) {
        // Add position to the start position, but ensure it's within bounds
        targetPos = Math.min(headingPos + 1 + position, headingPos + headingNode.nodeSize - 1)
      } else {
        // Handle negative positions (counting from the end)
        // -1 means end of node, -2 means one step before the end, etc.
        targetPos = headingPos + headingNode.nodeSize + position

        // Ensure we don't go before the start of the heading content
        targetPos = Math.max(targetPos, headingPos + 1)
      }
    }

    // Set the selection in the editor
    editor.commands.setTextSelection(targetPos)
    editor.commands.focus()

    // Return the element for Cypress chaining
    return cy.get('.ProseMirror-focused')
  })
})

Cypress.Commands.add('validateHeadingLevelChange', (headingText, currentLevel, newLevel) => {
  return cy.window().then((win) => {
    const editor = win._editor

    if (!editor) {
      throw new Error('Tiptap editor not found.')
    }

    let headingNode = null
    let headingPos = null
    let parentNode = null
    let childNodes = []
    let siblings = []

    // Find the target heading
    editor.state.doc.descendants((node, pos, parent) => {
      if (
        node.type.name === 'heading' &&
        node.attrs.level === currentLevel &&
        node.textContent.includes(headingText)
      ) {
        headingNode = node
        headingPos = pos
        return false
      }
    })

    if (!headingNode) {
      throw new Error(`Heading level ${currentLevel} with text "${headingText}" not found`)
    }

    // Find parent heading (if exists)
    let parentFound = false
    let parentPos = null

    editor.state.doc.descendants((node, pos) => {
      if (parentFound || pos >= headingPos) return false

      if (node.type.name === 'heading') {
        // Check if this is a potential parent (lower level number = higher in hierarchy)
        // Parent must have lower level number than current heading
        if (node.attrs.level < currentLevel) {
          parentNode = node
          parentPos = pos
        }
      }
    })

    // Find child headings
    editor.state.doc.nodesBetween(headingPos, editor.state.doc.content.size, (node, pos) => {
      // Skip the heading itself
      if (pos === headingPos) return true

      // If we encounter a heading with level <= current heading's level, we've moved past its scope
      if (node.type.name === 'heading' && node.attrs.level <= currentLevel) {
        return false
      }

      // If we find a heading with level > current heading's level, it's a child
      if (node.type.name === 'heading' && node.attrs.level > currentLevel) {
        childNodes.push({ node, pos })
      }

      return true
    })

    // Find sibling headings (same level headings within the same parent)
    if (parentNode) {
      let inParentScope = false
      editor.state.doc.descendants((node, pos) => {
        if (pos === parentPos) {
          inParentScope = true
          return true
        }

        // If we encounter a heading with level <= parent's level, we've moved past its scope
        if (
          inParentScope &&
          node.type.name === 'heading' &&
          node.attrs.level <= parentNode.attrs.level
        ) {
          inParentScope = false
          return false
        }

        // If we're in the parent's scope and find a heading with the same level as our target
        if (
          inParentScope &&
          node.type.name === 'heading' &&
          node.attrs.level === currentLevel &&
          pos !== headingPos
        ) {
          siblings.push({ node, pos })
        }

        return true
      })
    }

    // VALIDATION RULES

    // Rule 1: Heading levels 2-9 must be nested within a section (level 1)
    // This is implicitly handled by the editor structure, as all content should be in sections

    // Rule 2: New level must be between 2-9
    if (newLevel < 2 || newLevel > 9) {
      return { valid: false, reason: `Heading level must be between 2-9, got ${newLevel}` }
    }

    // Rule 3: If parent exists, new level must be greater than parent level
    if (parentNode && newLevel <= parentNode.attrs.level) {
      return {
        valid: false,
        reason: `New level ${newLevel} must be greater than parent level ${parentNode.attrs.level}`
      }
    }

    // Rule 4: If children exist, new level must be less than all child levels
    // Note: If this rule fails, child headings need to be updated to maintain proper hierarchy
    // Use applyHeadingLevelChange with updateChildren: true to handle this automatically
    const invalidChildren = childNodes.filter((child) => child.node.attrs.level <= newLevel)
    if (invalidChildren.length > 0) {
      return {
        valid: false,
        reason: `New level ${newLevel} must be less than child levels (found ${invalidChildren.length} children with level <= ${newLevel})`,
        affectedChildren: invalidChildren.length
      }
    }

    // Rule 5: If siblings exist after the change, they should be at the same level as the new level
    // This is more of a warning than an error
    if (siblings.length > 0) {
      return {
        valid: true,
        warning: `Changing level to ${newLevel} will make this heading inconsistent with its ${siblings.length} siblings at level ${currentLevel}`
      }
    }

    return { valid: true }
  })
})

Cypress.Commands.add('applyHeadingLevelChange', (headingText, currentLevel, newLevel) => {
  return cy.validateHeadingLevelChange(headingText, currentLevel, newLevel).then((result) => {
    // Log the validation result
    if (result.valid) {
      if (result.warning) {
        cy.log(`Warning: ${result.warning}`)
      } else {
        cy.log(`Validation passed: Changing heading from level ${currentLevel} to ${newLevel}`)
      }
    } else {
      cy.log(`Error: ${result.reason}`)
    }

    // Only proceed if validation passed
    if (result.valid) {
      return cy.window().then((win) => {
        const editor = win._editor

        if (!editor) {
          throw new Error('Tiptap editor not found.')
        }

        // Find the target heading position
        let headingFound = false
        let headingPos = null

        editor.state.doc.descendants((node, pos) => {
          if (headingFound) return false

          if (
            node.type.name === 'heading' &&
            node.attrs.level === currentLevel &&
            node.textContent.includes(headingText)
          ) {
            headingFound = true
            headingPos = pos
            return false
          }
        })

        if (!headingFound || headingPos === null) {
          throw new Error(`Heading level ${currentLevel} with text "${headingText}" not found`)
        }

        // Create a sequence of actions to perform
        const actions = []

        // Update the main heading
        actions.push(() => {
          cy.log(`Updating main heading "${headingText}" from level ${currentLevel} to ${newLevel}`)
          return cy
            .putPosCaretInHeading(currentLevel, headingText, 'start')
            .realPress(['Alt', 'Meta', `${newLevel}`])
        })

        // Execute all actions in sequence
        const executeActions = (index = 0) => {
          if (index >= actions.length) {
            // All done, verify the change was successful
            return cy
              .get('.heading')
              .contains(headingText)
              .closest('.heading')
              .should('have.attr', 'level', `${newLevel}`)
              .then(() => {
                return cy.wrap({
                  applied: true,
                  previousLevel: currentLevel,
                  newLevel,
                  warnings: result.warning
                })
              })
          }

          // Execute the current action, then move to the next
          return actions[index]().then(() => {
            return executeActions(index + 1)
          })
        }

        // Start executing the action sequence
        return executeActions()
      })
    } else {
      // Return failure result
      return cy.wrap({
        applied: false,
        reason: result.reason
      })
    }
  })
})

// Select content at the specified hierarchical level
Cypress.Commands.add(
  'clickAndSelect',
  { prevSubject: 'element' },
  (subject, level: SelectionLevel) => {
    // First click on the element
    cy.wrap(subject).click()

    // Then use the _editorSelect function
    return cy.window().then((win) => {
      // @ts-ignore - the _editorSelect function is added to window in Controllers.tsx
      win._editorSelect(level)
      return cy.wrap(subject)
    })
  }
)

// Select and copy content at the specified hierarchical level
Cypress.Commands.add(
  'clickAndSelectCopy',
  { prevSubject: 'element' },
  ($element, level: SelectionLevel) => {
    // First click on the element
    cy.wrap($element).realClick().realPress('Home')

    // Then use the _editorSelectAndCopy function
    return cy.window().then((win) => {
      // @ts-ignore - the _editorSelectAndCopy function is added to window in Controllers.tsx
      win._editorSelectAndCopy(level)
      return cy.wrap($element)
    })
  }
)

Cypress.Commands.add('createSelection', (options) => {
  const {
    editorSelector = '.docy_editor > .tiptap.ProseMirror',
    startSection,
    startHeading,
    startParagraph,
    startPosition = 'start',
    endSection,
    endHeading,
    endParagraph,
    endPosition = 'end'
  } = options

  return cy.window().then(async (win) => {
    const editor = win.document.querySelector(editorSelector)
    if (!editor) throw new Error(`Editor element not found with selector: ${editorSelector}`)

    // Find the start element
    const startElement = findElement({
      editor,
      section: startSection,
      heading: startHeading,
      paragraph: startParagraph
    })

    // Find the end element (if different from start)
    let endElement = startElement
    if (endSection || endHeading || endParagraph) {
      endElement = findElement({
        editor,
        section: endSection,
        heading: endHeading,
        paragraph: endParagraph
      })
    }

    // Create the selection
    const selection = win.document.getSelection()
    const range = win.document.createRange()

    // Set start position
    setRangePosition(range, startElement, startPosition, true)

    // Set end position
    setRangePosition(range, endElement, endPosition, false)

    // Apply the selection
    selection.removeAllRanges()
    selection.addRange(range)

    return cy.wrap({ startElement, endElement, range })
  })

  function findElement({ editor, section, heading, paragraph }) {
    let element = editor

    // Find section if specified
    if (section) {
      const sectionSelector =
        typeof section === 'object' ? `.heading[level="1"]` : `.heading[level="1"]`

      const sections = Array.from(editor.querySelectorAll(sectionSelector))
      let foundSection

      if (typeof section === 'object') {
        // Find by properties like title content
        const { title } = section
        foundSection = sections.find((s) => {
          const titleElement = s.querySelector('.title')
          return titleElement && titleElement.textContent?.includes(title)
        })
      } else if (typeof section === 'number') {
        // Find by index
        foundSection = sections[section - 1] // 1-based index for user-friendliness
      }

      if (!foundSection) throw new Error(`Section not found: ${JSON.stringify(section)}`)
      element = foundSection
    }

    // Find heading if specified
    if (heading) {
      const headingSelector = typeof heading === 'object' ? `.heading` : `.heading`

      const headings = Array.from(element.querySelectorAll(headingSelector))
      let foundHeading

      if (typeof heading === 'object') {
        // Find by properties
        const { level, title } = heading
        foundHeading = headings.find((h) => {
          const titleElement = h.querySelector('.title')
          const headingLevel = parseInt(h.getAttribute('level') || '0')
          return (
            (!level || headingLevel === level) &&
            (!title || (titleElement && titleElement.textContent?.includes(title)))
          )
        })
      } else if (typeof heading === 'number') {
        // Find by index
        foundHeading = headings[heading - 1] // 1-based index
      }

      if (!foundHeading) throw new Error(`Heading not found: ${JSON.stringify(heading)}`)
      element = foundHeading //foundHeading.querySelector('.contents') || foundHeading
    }

    // Find paragraph if specified
    if (paragraph) {
      const paragraphs = Array.from(element.querySelectorAll('p'))
      let foundParagraph

      if (typeof paragraph === 'object') {
        // Find by content
        const { text } = paragraph
        foundParagraph = paragraphs.find((p) => text && p.textContent?.includes(text))
      } else if (typeof paragraph === 'number') {
        // Find by index
        foundParagraph = paragraphs[paragraph - 1] // 1-based index
      }

      if (!foundParagraph) throw new Error(`Paragraph not found: ${JSON.stringify(paragraph)}`)
      element = foundParagraph
    }

    return element
  }

  function setRangePosition(range, element, position, isStart) {
    if (element.nodeType === Node.TEXT_NODE) {
      // Handle text node
      if (position === 'start') {
        position = 0
      } else if (position === 'end') {
        position = element.textContent?.length || 0
      }

      if (isStart) {
        range.setStart(element, position)
      } else {
        range.setEnd(element, position)
      }
    } else {
      // Handle element node
      if (position === 'start') {
        // Find first text node
        const textNode = findFirstTextNode(element)
        if (textNode) {
          if (isStart) {
            range.setStart(textNode, 0)
          } else {
            range.setEnd(textNode, 0)
          }
        } else {
          if (isStart) {
            range.setStart(element, 0)
          } else {
            range.setEnd(element, 0)
          }
        }
      } else if (position === 'end') {
        // Find last text node
        const textNode = findLastTextNode(element)
        if (textNode) {
          if (isStart) {
            range.setStart(textNode, textNode.textContent?.length || 0)
          } else {
            range.setEnd(textNode, textNode.textContent?.length || 0)
          }
        } else {
          if (isStart) {
            range.setStart(element, element.childNodes.length)
          } else {
            range.setEnd(element, element.childNodes.length)
          }
        }
      } else if (typeof position === 'number') {
        // Try to find text node first
        const textNode = findFirstTextNode(element)
        if (textNode) {
          const maxPos = textNode.textContent?.length || 0
          const pos = position > maxPos ? maxPos : position
          if (isStart) {
            range.setStart(textNode, pos)
          } else {
            range.setEnd(textNode, pos)
          }
        } else {
          // Fall back to element
          const maxPos = element.childNodes.length
          const pos = position > maxPos ? maxPos : position
          if (isStart) {
            range.setStart(element, pos)
          } else {
            range.setEnd(element, pos)
          }
        }
      }
    }
  }

  function findFirstTextNode(element) {
    if (element.nodeType === Node.TEXT_NODE) return element

    // Search for first text node in children
    for (let i = 0; i < element.childNodes.length; i++) {
      const result = findFirstTextNode(element.childNodes[i])
      if (result) {
        return result
      }
    }

    return null
  }

  function findLastTextNode(element) {
    if (element.nodeType === Node.TEXT_NODE) return element

    // Search for last text node in children, reversed order
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
      const result = findLastTextNode(element.childNodes[i])
      if (result) return result
    }

    return null
  }
})

/**
 * Validates the DOM structure according to editor schema rules
 * - Level 1 headings (sections) cannot be nested inside each other
 * - Headings range from level 2-10 and must be nested inside a section
 * - Heading hierarchy must be maintained (child level > parent level)
 */
Cypress.Commands.add(
  'validateDomStructure',
  (options?: { throwOnError?: boolean; logResults?: boolean }) => {
    // Default options
    const opts = {
      throwOnError: true,
      logResults: true,
      ...(options || {})
    }

    // Get the editor element
    return cy.get('.tiptap__editor').then(($editor) => {
      const errors: string[] = []
      const structure: any[] = []

      // Function to recursively parse and validate the heading structure
      function parseHeadingStructure(
        element: Element,
        parentLevel: number = 0,
        path: string = 'root'
      ): void {
        // Get all immediate heading children
        const headings = Array.from(element.querySelectorAll(':scope > .heading'))

        headings.forEach((heading, index) => {
          const level = parseInt(heading.getAttribute('level') || '0', 10)
          const titleElement = heading.querySelector('.title')
          const title = titleElement ? titleElement.textContent : 'Untitled'
          const headingPath = `${path} > heading[${index}](level=${level}, title="${title}")`

          const headingInfo = {
            level,
            title,
            children: [],
            path: headingPath
          }

          // Add to structure
          structure.push(headingInfo)

          // Validate level 1 headings (sections)
          if (level === 1 && parentLevel !== 0) {
            errors.push(
              `Section (level 1) cannot be nested inside another heading: "${title}" at ${headingPath}`
            )
          }

          // Validate headings range
          if (level < 1 || level > 10) {
            errors.push(
              `Heading level must be between 1 and 10, found ${level}: "${title}" at ${headingPath}`
            )
          }

          // Validate heading hierarchy (child level > parent level)
          if (parentLevel > 0 && level <= parentLevel && level > 1) {
            errors.push(
              `Heading hierarchy violated: Level ${level} heading "${title}" cannot be nested inside level ${parentLevel} at ${headingPath}`
            )
          }

          // Recursively validate content wrapper
          const contentWrapper = heading.querySelector('.contentWrapper')
          if (contentWrapper) {
            const contents = contentWrapper.querySelector('.contents')
            if (contents) {
              // Recursively parse nested headings
              parseHeadingStructure(contents, level, headingPath)
            }
          }
        })
      }

      // Start parsing from the root
      const editor = $editor[0]
      const editorContent = editor.querySelector('.ProseMirror')
      if (editorContent) {
        parseHeadingStructure(editorContent)
      }

      // Build the result
      const result = {
        valid: errors.length === 0,
        errors,
        structure
      }

      // Log results if requested
      if (opts.logResults) {
        cy.log(`DOM Structure Validation ${result.valid ? 'PASSED' : 'FAILED'}`)
        if (!result.valid) {
          errors.forEach((error) => {
            cy.log(`ERROR: ${error}`)
          })
        }
      }

      // Throw if requested and errors exist
      if (opts.throwOnError && !result.valid) {
        throw new Error(`DOM Structure Validation Failed: ${errors.join(', ')}`)
      }

      return cy.wrap(result)
    })
  }
)
