/// <reference types="cypress" />

// ---------------------------------------------------------------------------
// Typed window globals exposed by the app at runtime for Cypress tests.
// See: src/pages/editor.tsx, src/components/pages/editor/Controllers.tsx
// ---------------------------------------------------------------------------
type SelectionLevel = 'element' | 'parent' | 'section' | 'heading' | 'list' | 'document'

interface EditorWindow {
  /** TipTap editor instance – set in editor.tsx */
  _editor?: import('@tiptap/core').Editor
  /** Programmatic document builder – set in editor.tsx */
  _createDocumentFromStructure?: (doc: Record<string, unknown>) => boolean
  /** Programmatic heading move – set in editor.tsx */
  _moveHeading?: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
    level?: number
  ) => boolean
  /** Hierarchical selection helpers – set in Controllers.tsx */
  _editorSelect?: (level: SelectionLevel) => void
  _editorSelectAndCopy?: (level: SelectionLevel) => void
  _editorSelectElement?: (level: SelectionLevel) => void
  /** Markdown helpers – available when @tiptap/markdown is loaded */
  _getMarkdown?: () => string
  _parseMarkdown?: (md: string) => Record<string, unknown> | undefined
}

// ---------------------------------------------------------------------------
// Test data constants
// ---------------------------------------------------------------------------
interface TestContent {
  short: string
  medium: string
  long: string
  empty: string
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

// Document validators removed — flat schema uses decoration-based structure

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      clearEditor(): Chainable<void>
      createHeading(
        title: string,
        headingLevel: number,
        sentencesCount?: number
      ): Chainable<Element>
      enter(times?: number): Chainable<Element>
      getEditor(): Chainable<Element>
      createDocument(doc: any): Chainable<Element>
      createOrderedList(items: Array<{ text: string; indent?: number }>): Chainable<void>
      createBulletList(items: Array<{ text: string; indent?: number }>): Chainable<void>
      createHeadingWithContent(content: {
        level: number
        title: string
        contents: Array<{
          type: 'paragraph' | 'orderedList' | 'bulletList' | 'heading'
          content?: any
          contents?: any[]
        }>
      }): Chainable<Element>
      visitEditor(options: { persist?: boolean; docName: string }): Chainable<Element>

      clearInlineNode(): Chainable<Element>
      pasteAsPlainText(text: string): Chainable<void>
      pasteWithMimeTypes(data: Record<string, string>, extraTypes?: string[]): Chainable<void>
      writeToClipboard(text: string): Chainable<Element>
      readFromClipboard(): Chainable<Element>
      copySelectionToClipboard(): Chainable<Element>
      pasteClipboardHtml(): Chainable<Element>

      clickAndSelect(level: SelectionLevel): Chainable<Element>
      clickAndSelectCopy(level: SelectionLevel): Chainable<Element>
      applyHeadingLevelChange(
        headingText: string,
        currentLevel: number,
        newLevel: number
      ): Chainable<Element>
      validateHeadingLevelChange(
        headingText: string,
        currentLevel: number,
        newLevel: number
      ): Chainable<Element>
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

Cypress.Commands.add(
  'createOrderedList',
  function (items: Array<{ text: string; indent?: number }>) {
    if (!items.length) return

    cy.get('.docy_editor > .tiptap.ProseMirror')
      .type(items[0].text)
      .realPress(['Shift', 'Meta', '7']) // Create ordered list
      .realPress(['Enter'])

    let currentIndent = 0
    // Start from index 1 since we've already handled the first item
    items
      .slice(1)
      .forEach(
        (
          item: { text: string; indent?: number },
          index: number,
          array: Array<{ text: string; indent?: number }>
        ) => {
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
        }
      )
  }
)

Cypress.Commands.add(
  'createBulletList',
  function (items: Array<{ text: string; indent?: number }>) {
    if (!items.length) return

    cy.get('.docy_editor > .tiptap.ProseMirror')
      .type(items[0].text)
      .realPress(['Shift', 'Meta', '8']) // Create bullet list
      .realPress(['Enter'])

    let currentIndent = 0
    // Start from index 1 since we've already handled the first item
    items
      .slice(1)
      .forEach(
        (
          item: { text: string; indent?: number },
          index: number,
          array: Array<{ text: string; indent?: number }>
        ) => {
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
        }
      )
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.add('createHeadingWithContent', (content: any) => {
  const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
  const { level, title, contents } = content

  editor
    .type(title)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .realPress(['Alt', 'Meta', String(level)] as any)
    .realPress('Enter')

  if (!contents || contents.length === 0) return

  for (const item of contents) {
    switch (item?.type) {
      case 'paragraph':
        cy.createParagraph(item.content)
        break
      case 'orderedList':
        cy.createOrderedList(item.content)
        break
      case 'bulletList':
        cy.createBulletList(item.content)
        break
      case 'heading':
        cy.createHeadingWithContent(item)
        break
    }
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.add('createDocument', (doc: any) => {
  // Normalize doc to { sections: [...] } format
  let normalizedDoc = doc
  if (Array.isArray(doc)) {
    normalizedDoc = { sections: doc }
  } else if (!doc.sections) {
    normalizedDoc = { sections: [doc] }
  }

  // Use fast direct insertion via window._createDocumentFromStructure
  cy.window().then((w) => {
    const win = w as unknown as EditorWindow
    if (typeof win._createDocumentFromStructure === 'function') {
      const success = win._createDocumentFromStructure(normalizedDoc as Record<string, unknown>)
      if (!success) {
        throw new Error('Failed to create document via _createDocumentFromStructure')
      }
    } else {
      console.warn('_createDocumentFromStructure not available, using slow typing method')
      const sections = doc.sections

      cy.get('.docy_editor > .tiptap.ProseMirror')
        .click({ force: true })
        .realPress(['Meta', 'a', 'Backspace'])

      for (const [index, section] of sections.entries()) {
        cy.createSection({
          title: section.title,
          contents: section.contents ?? [],
          isFirst: index === 0
        })
      }
    }
  })

  cy.get('.docy_editor h1[data-toc-id]').should('exist')
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.add('createSection', (section: any) => {
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
        cy.createHeadingWithContent(content)
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

// @ts-expect-error — 'Document' is a legacy custom command not in the Chainable interface
Cypress.Commands.add('Document', (title: string, _content?: string) => {
  const editor = cy.get('.docy_editor > .tiptap.ProseMirror')
  editor.click().type('{selectall}{del}', { release: false })
  editor.type(title).type('{enter}').type(TEST_CONTENT.short)
})

Cypress.Commands.add(
  'createHeading',
  (title: string, headingLevel = 2, sentencesCount?: number) => {
    const editor = cy
      .get('.docy_editor > .tiptap.ProseMirror')
      .type(`${title}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .realPress(['Alt', 'Meta', String(headingLevel)] as any)
    if (sentencesCount) {
      editor.type(generatePredictableText(sentencesCount))
    }
  }
)

Cypress.Commands.add('enter', (times = 1) => {
  for (let i = 0; i < times; i++) {
    cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Enter'])
  }
})

// @ts-expect-error — custom command return type differs from Chainable<Element>
Cypress.Commands.add('getEditor', () => {
  return cy.window().then((win) => (win as unknown as EditorWindow)._editor)
})

Cypress.Commands.add(
  'visitEditor',
  ({
    persist = false,
    docName,
    clearDoc = false
  }: { persist?: boolean; docName?: string; clearDoc?: boolean } = {}) => {
    const runnerEnv = (Cypress.config('env') || {}) as Record<string, unknown>
    const configuredBaseUrl = runnerEnv.EDITOR_BASE_URL
    const configuredConfigBaseUrl = Cypress.config('baseUrl')
    const baseUrl =
      typeof configuredBaseUrl === 'string' && configuredBaseUrl.length > 0
        ? configuredBaseUrl
        : typeof configuredConfigBaseUrl === 'string' && configuredConfigBaseUrl.length > 0
          ? configuredConfigBaseUrl
          : 'http://localhost:3001'
    const editorUrl = `${baseUrl.replace(/\/$/, '')}/editor`

    if (persist && docName) {
      cy.visit(`${editorUrl}?localPersistence=${persist}&docName=${docName}`)
    } else {
      cy.visit(editorUrl)
    }
    cy.get('.docy_editor > .tiptap.ProseMirror').should('be.visible')
    if (clearDoc) {
      cy.get('.docy_editor > .tiptap.ProseMirror')
        .click()
        .realPress(['Meta', 'a', 'Backspace'])
        .wait(100)
    }
  }
)

Cypress.Commands.add('clearEditor', () => {
  cy.get('.docy_editor > .tiptap.ProseMirror')
    .scrollIntoView()
    .click({ force: true })
    .realPress(['Meta', 'a', 'Backspace'])
})

Cypress.Commands.add('pasteAsPlainText', (text: string) => {
  cy.get('.docy_editor > .tiptap.ProseMirror').then(($el) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true
    })

    $el[0].dispatchEvent(pasteEvent)
  })
})

Cypress.Commands.add(
  'pasteWithMimeTypes',
  (data: Record<string, string>, extraTypes?: string[]) => {
    cy.get('.docy_editor > .tiptap.ProseMirror').then(($el) => {
      const clipboardData = new DataTransfer()
      for (const [mime, value] of Object.entries(data)) {
        clipboardData.setData(mime, value)
      }
      if (extraTypes) {
        for (const t of extraTypes) {
          clipboardData.setData(t, '')
        }
      }

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })

      $el[0].dispatchEvent(pasteEvent)
    })
  }
)

// @ts-expect-error — Cypress prevSubject typing limitation
Cypress.Commands.add(
  'copySelectionToClipboard',
  { prevSubject: 'element' },
  ($element: JQuery<HTMLElement>) => {
    const doc = $element[0].ownerDocument
    const selection = doc.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null

    if (!range || !selection || selection.isCollapsed) {
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
  }
)

Cypress.Commands.add(
  'pasteClipboardHtml',
  { prevSubject: 'element' },
  ($element: JQuery<HTMLElement>) => {
    cy.window().then((win) => {
      return win.navigator.clipboard.read().then(async (items: ClipboardItem[]) => {
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html')
            const html = await blob.text()

            const pasteEvent = new ClipboardEvent('paste', {
              clipboardData: new DataTransfer(),
              bubbles: true,
              cancelable: true
            })

            pasteEvent.clipboardData!.setData('text/html', html)
            $element[0].dispatchEvent(pasteEvent)
            return
          }
        }
        throw new Error('No HTML content found in clipboard.')
      })
    })
  }
)

// @ts-expect-error — custom command return type differs from Chainable<Element>
Cypress.Commands.add(
  'putPosCaretInHeading',
  (level: number, headingText: string, position: 'start' | 'end' | number = 'end') => {
    return cy.window().then((w) => {
      const win = w as unknown as EditorWindow
      const editor = win._editor

      if (!editor) {
        throw new Error(
          'Tiptap editor not found. Make sure it is initialized and accessible as window._editor'
        )
      }

      let headingFound = false
      let headingPos = 0
      let headingNodeSize = 0

      editor.state.doc.descendants((node, pos) => {
        if (headingFound) return false

        if (
          node.type.name === 'heading' &&
          node.attrs.level === level &&
          node.textContent.includes(headingText)
        ) {
          headingFound = true
          headingPos = pos
          headingNodeSize = node.nodeSize
          return false
        }
      })

      if (!headingFound || !headingNodeSize) {
        throw new Error(
          `Heading level ${level} with text "${headingText}" not found in the document`
        )
      }

      const nodeSize = headingNodeSize

      // Calculate the position for the cursor
      let targetPos = headingPos + 1 // Default to start of heading content

      if (position === 'end') {
        targetPos = headingPos + nodeSize - 1
      } else if (typeof position === 'number') {
        if (position >= 0) {
          // Add position to the start position, but ensure it's within bounds
          targetPos = Math.min(headingPos + 1 + position, headingPos + nodeSize - 1)
        } else {
          // Handle negative positions (counting from the end)
          // -1 means end of node, -2 means one step before the end, etc.
          targetPos = headingPos + nodeSize + position

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
  }
)

// @ts-expect-error — custom command return type differs from Chainable<Element>
Cypress.Commands.add(
  'validateHeadingLevelChange',
  (headingText: string, currentLevel: number, newLevel: number) => {
    return cy.window().then((w) => {
      const win = w as unknown as EditorWindow
      const editor = win._editor

      if (!editor) {
        throw new Error('Tiptap editor not found.')
      }

      let headingNode: ReturnType<typeof editor.state.doc.nodeAt> = null
      let headingPos: number | null = null
      let parentNode: ReturnType<typeof editor.state.doc.nodeAt> = null
      const childNodes: Array<{
        node: NonNullable<ReturnType<typeof editor.state.doc.nodeAt>>
        pos: number
      }> = []
      const siblings: Array<{
        node: NonNullable<ReturnType<typeof editor.state.doc.nodeAt>>
        pos: number
      }> = []

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

      if (!headingNode || headingPos === null) {
        throw new Error(`Heading level ${currentLevel} with text "${headingText}" not found`)
      }

      // Find parent heading (if exists)
      let parentFound = false
      let parentPos: number | null = null

      editor.state.doc.descendants((node, pos) => {
        if (parentFound || pos >= headingPos!) return false

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
      editor.state.doc.nodesBetween(headingPos!, editor.state.doc.content.size, (node, pos) => {
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
      if (parentNode && parentPos !== null) {
        let inParentScope = false
        const parentLevel = (parentNode as { attrs: { level: number } }).attrs.level
        editor.state.doc.descendants((node, pos) => {
          if (pos === parentPos) {
            inParentScope = true
            return true
          }

          // If we encounter a heading with level <= parent's level, we've moved past its scope
          if (inParentScope && node.type.name === 'heading' && node.attrs.level <= parentLevel) {
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

      if (newLevel < 1 || newLevel > 6) {
        return { valid: false, reason: `Heading level must be between 1-6, got ${newLevel}` }
      }

      // Rule 3: If parent exists, new level must be greater than parent level
      const parentAttrsLevel = parentNode
        ? (parentNode as unknown as { attrs: { level: number } }).attrs.level
        : null
      if (parentNode && parentAttrsLevel !== null && newLevel <= parentAttrsLevel) {
        return {
          valid: false,
          reason: `New level ${newLevel} must be greater than parent level ${parentAttrsLevel}`
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
  }
)

// @ts-expect-error — custom command return type differs from Chainable<Element>
Cypress.Commands.add(
  'applyHeadingLevelChange',
  (headingText: string, currentLevel: number, newLevel: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return cy
      .validateHeadingLevelChange(headingText, currentLevel, newLevel)
      .then((result: any) => {
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
          return cy.window().then((w) => {
            const win = w as unknown as EditorWindow
            const editor = win._editor

            if (!editor) {
              throw new Error('Tiptap editor not found.')
            }

            // Find the target heading position
            let headingFound = false
            let headingPos: number | null = null

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
            const actions: Array<() => Cypress.Chainable> = []

            // Update the main heading
            actions.push(() => {
              cy.log(
                `Updating main heading "${headingText}" from level ${currentLevel} to ${newLevel}`
              )
              return (
                (
                  cy as unknown as {
                    putPosCaretInHeading: (
                      level: number,
                      text: string,
                      pos: string
                    ) => Cypress.Chainable
                  }
                )
                  .putPosCaretInHeading(currentLevel, headingText, 'start')
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .realPress(['Alt', 'Meta', `${newLevel}`] as any)
              )
            })

            // Execute all actions in sequence
            const executeActions = (index = 0): Cypress.Chainable => {
              if (index >= actions.length) {
                // All done, verify the change was successful.
                // Use exact title matching to avoid substring collisions
                // (e.g. "Direct Subsection" matching "Another Direct Subsection").
                return cy
                  .get(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]')
                  .filter((_i, el) => {
                    return el.textContent?.trim() === headingText
                  })
                  .first()
                  .should('match', `h${newLevel}`)
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
  }
)

// Select content at the specified hierarchical level
// @ts-expect-error — Cypress prevSubject overload typing limitation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.add(
  'clickAndSelect',
  { prevSubject: 'optional' },
  (subject: any, level: SelectionLevel) => {
    // First click on the element
    cy.wrap(subject).click()

    // Then use the _editorSelect function
    return cy.window().then((win) => {
      const editorWin = win as unknown as EditorWindow
      editorWin._editorSelect?.(level)
      return cy.wrap(subject)
    })
  }
)

// Select and copy content at the specified hierarchical level
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @ts-expect-error — Cypress prevSubject overload typing limitation
Cypress.Commands.add(
  'clickAndSelectCopy',
  { prevSubject: 'optional' },
  ($element: any, level: SelectionLevel) => {
    // First click on the element
    cy.wrap($element).realClick().realPress('Home')

    // Then use the _editorSelectAndCopy function
    return cy.window().then((win) => {
      const editorWin = win as unknown as EditorWindow
      editorWin._editorSelectAndCopy?.(level)
      return cy.wrap($element)
    })
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.add('createSelection', (options: any) => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cy.window().then((win: any) => {
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
    selection?.removeAllRanges()
    selection?.addRange(range)

    // Sync with TipTap editor selection synchronously
    const tiptapEditor = (win as unknown as EditorWindow)._editor
    if (tiptapEditor) {
      const view = tiptapEditor.view
      if (view) {
        view.focus()
        try {
          const anchorNode = range.startContainer
          const focusNode = range.endContainer
          const anchorPos = view.posAtDOM(anchorNode, range.startOffset)
          const focusPos = view.posAtDOM(focusNode, range.endOffset)
          tiptapEditor.commands.setTextSelection({ from: anchorPos, to: focusPos })
        } catch {
          // Selection sync failed, continue with DOM selection
        }
      }
    }

    return cy.wrap({ startElement, endElement, range }).wait(100)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findElement({
    editor,
    section,
    heading,
    paragraph
  }: {
    editor: any
    section?: any
    heading?: any
    paragraph?: any
  }): any {
    let element = editor

    if (section) {
      const sections = Array.from(editor.querySelectorAll('h1[data-toc-id]'))
      let foundSection

      if (typeof section === 'object') {
        const { title } = section
        foundSection = sections.find((s: unknown) => {
          return (s as Element).textContent?.includes(title)
        })
      } else if (typeof section === 'number') {
        foundSection = sections[section - 1]
      }

      if (!foundSection) throw new Error(`Section not found: ${JSON.stringify(section)}`)
      element = foundSection
    }

    if (heading) {
      const headings = Array.from(
        element.querySelectorAll(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]')
      )
      let foundHeading

      if (typeof heading === 'object') {
        const { level, title } = heading
        foundHeading = headings.find((h: unknown) => {
          const el = h as Element
          const headingLevel = parseInt(el.tagName.replace('H', '') || '0')
          return (!level || headingLevel === level) && (!title || el.textContent?.includes(title))
        })
      } else if (typeof heading === 'number') {
        foundHeading = headings[heading - 1]
      }

      if (!foundHeading) throw new Error(`Heading not found: ${JSON.stringify(heading)}`)
      element = foundHeading
    }

    // Find paragraph if specified
    if (paragraph) {
      const paragraphs = Array.from(element.querySelectorAll('p'))
      let foundParagraph

      if (typeof paragraph === 'object') {
        // Find by content
        const { text } = paragraph
        foundParagraph = paragraphs.find(
          (p: unknown) => text && (p as Element).textContent?.includes(text)
        )
      } else if (typeof paragraph === 'number') {
        // Find by index
        foundParagraph = paragraphs[paragraph - 1] // 1-based index
      }

      if (!foundParagraph) throw new Error(`Paragraph not found: ${JSON.stringify(paragraph)}`)
      element = foundParagraph
    }

    return element
  }

  function setRangePosition(
    range: Range,
    element: Node,
    position: 'start' | 'end' | number,
    isStart: boolean
  ): void {
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

  function findFirstTextNode(element: Node): Node | null {
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

  function findLastTextNode(element: Node): Node | null {
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
    return cy.get('.docy_editor').then(($editor) => {
      const errors: string[] = []
      const structure: any[] = []

      function parseHeadingStructure(editorEl: Element): void {
        const headings = Array.from(
          editorEl.querySelectorAll(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]')
        )

        headings.forEach((heading, index) => {
          const level = parseInt(heading.tagName.replace('H', '') || '0', 10)
          const title = heading.textContent || 'Untitled'
          const headingPath = `heading[${index}](level=${level}, title="${title}")`

          structure.push({ level, title, path: headingPath })

          if (level < 1 || level > 6) {
            errors.push(
              `Heading level must be between 1 and 6, found ${level}: "${title}" at ${headingPath}`
            )
          }

          if (index === 0 && level !== 1) {
            errors.push(
              `First heading must be level 1, found ${level}: "${title}" at ${headingPath}`
            )
          }
        })
      }

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

// =============================================================================
// TOC DRAG AND DROP COMMANDS
// =============================================================================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Get a TOC item by its heading text
       * @param headingText - The text content of the heading to find
       * @example cy.getTocItem('My Heading')
       */
      getTocItem(headingText: string): Chainable<JQuery<HTMLElement>>

      /**
       * Drag a TOC item to a target position with optional level change
       * @param sourceText - The text of the heading to drag
       * @param targetText - The text of the target heading
       * @param options - Drag options including position and level
       * @example cy.dragTocItem('Source Heading', 'Target Heading', { position: 'after', level: 3 })
       */
      dragTocItem(
        sourceText: string,
        targetText: string,
        options?: {
          position?: 'before' | 'after'
          level?: number
        }
      ): Chainable<void>

      /**
       * Verify TOC structure matches expected hierarchy
       * @param expectedStructure - Array of expected TOC items with nesting
       * @example cy.verifyTocStructure([{ text: 'H1', level: 1, children: [{ text: 'H2', level: 2 }] }])
       */
      verifyTocStructure(
        expectedStructure: Array<{
          text: string
          level: number
          children?: Array<{ text: string; level: number; children?: any[] }>
        }>
      ): Chainable<void>

      /**
       * Wait for TOC to be visible and ready
       */
      waitForToc(): Chainable<JQuery<HTMLElement>>
    }
  }
}

/**
 * Wait for TOC to be visible and ready
 */
Cypress.Commands.add('waitForToc', () => {
  return cy.get('.toc__list', { timeout: 10000 }).should('be.visible')
})

/**
 * Get a TOC item by its heading text
 */
Cypress.Commands.add('getTocItem', (headingText: string) => {
  return cy.get('.toc__list').contains('.toc__link', headingText).closest('.toc__item')
})

/**
 * Move a TOC item to a target position with optional level change.
 * Calls the editor directly via window._moveHeading to bypass dnd-kit.
 */
Cypress.Commands.add(
  'dragTocItem',
  (
    sourceText: string,
    targetText: string,
    options: { position?: 'before' | 'after'; level?: number } = {}
  ) => {
    const { position = 'after', level } = options

    // Get source element to find its ID
    cy.getTocItem(sourceText).then(($source) => {
      const sourceId = $source.attr('data-id')
      if (!sourceId) {
        throw new Error(`Source heading "${sourceText}" does not have data-id attribute`)
      }

      // Get target element to find its ID
      cy.getTocItem(targetText).then(($target) => {
        const targetId = $target.attr('data-id')
        if (!targetId) {
          throw new Error(`Target heading "${targetText}" does not have data-id attribute`)
        }

        // Call the programmatic move function exposed on window
        cy.window().then((w) => {
          const win = w as unknown as EditorWindow
          if (typeof win._moveHeading !== 'function') {
            throw new Error('window._moveHeading is not available. Make sure editor is loaded.')
          }

          const success = win._moveHeading(sourceId, targetId, position, level)
          if (!success) {
            throw new Error(`Failed to move heading "${sourceText}" to "${targetText}"`)
          }
        })

        // Wait for DOM to update
        cy.wait(300)
      })
    })
  }
)

/**
 * Verify TOC structure matches expected hierarchy
 */
Cypress.Commands.add(
  'verifyTocStructure',
  (
    expectedStructure: Array<{
      text: string
      level: number
      children?: Array<{ text: string; level: number; children?: any[] }>
    }>
  ) => {
    function verifyItems(items: typeof expectedStructure, parentSelector: string = '.toc__list') {
      items.forEach((expected, index) => {
        // Find the item at this level
        cy.get(parentSelector)
          .find('> .toc__item')
          .eq(index)
          .within(() => {
            // Verify text content
            cy.get('> a .toc__link').should('contain.text', expected.text)

            // Verify level attribute
            cy.root().should('have.attr', 'data-level', String(expected.level))

            // Recursively verify children if present
            if (expected.children && expected.children.length > 0) {
              cy.get('> ul.toc__list').should('exist')
              verifyItems(expected.children, '> ul.toc__list')
            }
          })
      })
    }

    // Start verification from root
    cy.get('.toc__list')
      .first()
      .within(() => {
        verifyItems(expectedStructure)
      })
  }
)
