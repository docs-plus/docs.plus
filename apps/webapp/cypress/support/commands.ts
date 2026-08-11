/// <reference types="cypress" />

// Window globals the app publishes at runtime; see src/pages/editor.tsx and Controllers.tsx.
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
  /** Zustand store handle – set in editor.tsx so specs can seed slices the playground doesn't populate naturally (e.g. `workspaceId`). */
  _store?: {
    getState: () => {
      setWorkspaceSetting: (key: string, value: unknown) => void
      [key: string]: unknown
    }
  }
}

export type { EditorWindow }

// Test data constants
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

/**
 * StarterKit's `trailingNode` appends an empty heading whenever the document
 * ends in another block, because `heading block*` makes heading the default
 * type. The TOC and Markdown export both drop it, so only raw DOM counts see
 * it. Pass this to `.should()` to keep the assertion retrying.
 */
export const haveNamedHeadingCount =
  (count: number) =>
  ($headings: JQuery<HTMLElement>): void => {
    const named = $headings.toArray().filter((el) => (el.textContent ?? '').trim() !== '')
    expect(named, 'headings with text').to.have.length(count)
  }

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

      /** Parse markdown via @tiptap/markdown and replace editor content. */
      setMarkdown(markdown: string): Chainable<void>
      /** Serialize the current document via editor.getMarkdown(). */
      getMarkdown(): Chainable<string>
      /** Count ProseMirror nodes of a given type name. */
      nodeCount(typeName: string): Chainable<number>

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

          if (indentDiff > 0) {
            for (let i = 0; i < indentDiff; i++) {
              cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Tab'])
            }
          } else if (indentDiff < 0) {
            for (let i = 0; i < Math.abs(indentDiff); i++) {
              cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Shift', 'Tab'])
            }
          }

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

          if (indentDiff > 0) {
            for (let i = 0; i < indentDiff; i++) {
              cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Tab'])
            }
          } else if (indentDiff < 0) {
            for (let i = 0; i < Math.abs(indentDiff); i++) {
              cy.get('.docy_editor > .tiptap.ProseMirror').realPress(['Shift', 'Tab'])
            }
          }

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
  let normalizedDoc = doc
  if (Array.isArray(doc)) {
    normalizedDoc = { sections: doc }
  } else if (!doc.sections) {
    normalizedDoc = { sections: [doc] }
  }

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

  // Alt+Meta+<n> sets the heading level; the first section needs no shortcut.
  if (isFirst) {
    editor.type(title).realPress('Enter')
  } else {
    editor.type(title).realPress(['Alt', 'Meta', '1']).realPress('Enter')
  }

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

  if (typeof content === 'string') {
    editor.type(content).realPress('Enter')
  } else if (Array.isArray(content)) {
    content.forEach((item, index) => {
      const text = typeof item === 'string' ? item : item.text

      editor.type(text)

      if (typeof item === 'object' && item.style) {
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
          }
        })
      }

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
  // realPress is a parent command, so a chained subject is discarded and the key
  // lands on whatever holds focus. Gate on focus, then press. Select-all and
  // delete are two presses: one chord of all three keys selects nothing.
  cy.get('.docy_editor > .tiptap.ProseMirror').scrollIntoView()
  cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
  cy.get('.docy_editor > .tiptap.ProseMirror').should('have.focus')
  cy.realPress(['Meta', 'a'])
  cy.realPress('Backspace')
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

      let targetPos = headingPos + 1 // Default to start of heading content

      if (position === 'end') {
        targetPos = headingPos + nodeSize - 1
      } else if (typeof position === 'number') {
        if (position >= 0) {
          targetPos = Math.min(headingPos + 1 + position, headingPos + nodeSize - 1)
        } else {
          // Negative positions count back from the end: -1 is the end of the node.
          targetPos = headingPos + nodeSize + position

          targetPos = Math.max(targetPos, headingPos + 1)
        }
      }

      editor.commands.setTextSelection(targetPos)
      editor.commands.focus()

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

      let parentFound = false
      let parentPos: number | null = null

      editor.state.doc.descendants((node, pos) => {
        if (parentFound || pos >= headingPos!) return false

        if (node.type.name === 'heading') {
          // A lower level number means higher in the hierarchy, so that is the parent.
          if (node.attrs.level < currentLevel) {
            parentNode = node
            parentPos = pos
          }
        }
      })

      editor.state.doc.nodesBetween(headingPos!, editor.state.doc.content.size, (node, pos) => {
        if (pos === headingPos) return true

        // If we encounter a heading with level <= current heading's level, we've moved past its scope
        if (node.type.name === 'heading' && node.attrs.level <= currentLevel) {
          return false
        }

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

      // Levels 2-9 nesting under a section is not checked here: the editor
      // structure already keeps all content inside a level-1 section.
      if (newLevel < 1 || newLevel > 6) {
        return { valid: false, reason: `Heading level must be between 1-6, got ${newLevel}` }
      }

      const parentAttrsLevel = parentNode
        ? (parentNode as unknown as { attrs: { level: number } }).attrs.level
        : null
      if (parentNode && parentAttrsLevel !== null && newLevel <= parentAttrsLevel) {
        return {
          valid: false,
          reason: `New level ${newLevel} must be greater than parent level ${parentAttrsLevel}`
        }
      }

      // A failure here means the child headings must be re-levelled first.
      const invalidChildren = childNodes.filter((child) => child.node.attrs.level <= newLevel)
      if (invalidChildren.length > 0) {
        return {
          valid: false,
          reason: `New level ${newLevel} must be less than child levels (found ${invalidChildren.length} children with level <= ${newLevel})`,
          affectedChildren: invalidChildren.length
        }
      }

      // Siblings left at the old level are a warning, not an error — the change still applies.
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
        if (result.valid) {
          if (result.warning) {
            cy.log(`Warning: ${result.warning}`)
          } else {
            cy.log(`Validation passed: Changing heading from level ${currentLevel} to ${newLevel}`)
          }
        } else {
          cy.log(`Error: ${result.reason}`)
        }

        if (result.valid) {
          return cy.window().then((w) => {
            const win = w as unknown as EditorWindow
            const editor = win._editor

            if (!editor) {
              throw new Error('Tiptap editor not found.')
            }

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

            const actions: Array<() => Cypress.Chainable> = []

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

            const executeActions = (index = 0): Cypress.Chainable => {
              if (index >= actions.length) {
                // Exact title matching avoids substring collisions
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

              return actions[index]().then(() => {
                return executeActions(index + 1)
              })
            }

            return executeActions()
          })
        } else {
          return cy.wrap({
            applied: false,
            reason: result.reason
          })
        }
      })
  }
)

// @ts-expect-error — Cypress prevSubject overload typing limitation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.add(
  'clickAndSelect',
  { prevSubject: 'optional' },
  (subject: any, level: SelectionLevel) => {
    cy.wrap(subject).click()

    return cy.window().then((win) => {
      const editorWin = win as unknown as EditorWindow
      editorWin._editorSelect?.(level)
      return cy.wrap(subject)
    })
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @ts-expect-error — Cypress prevSubject overload typing limitation
Cypress.Commands.add(
  'clickAndSelectCopy',
  { prevSubject: 'optional' },
  ($element: any, level: SelectionLevel) => {
    cy.wrap($element).realClick().realPress('Home')

    return cy.window().then((win) => {
      const editorWin = win as unknown as EditorWindow
      editorWin._editorSelectAndCopy?.(level)
      return cy.wrap($element)
    })
  }
)

// createSelection + validateDomStructure → cypress/support/editor/selectionCommands.ts

// TOC drag and drop commands
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      getTocItem(headingText: string): Chainable<JQuery<HTMLElement>>

      dragTocItem(
        sourceText: string,
        targetText: string,
        options?: {
          position?: 'before' | 'after'
          level?: number
        }
      ): Chainable<void>

      verifyTocStructure(
        expectedStructure: Array<{
          text: string
          level: number
          children?: Array<{ text: string; level: number; children?: any[] }>
        }>
      ): Chainable<void>

      waitForToc(): Chainable<JQuery<HTMLElement>>
    }
  }
}

Cypress.Commands.add('waitForToc', () => {
  return cy.get('.toc__list', { timeout: 10000 }).should('be.visible')
})

Cypress.Commands.add('getTocItem', (headingText: string) => {
  return cy.get('.toc__list').contains('.toc__link', headingText).closest('.toc__item')
})

/** Calls the editor directly via `window._moveHeading` to bypass dnd-kit. */
Cypress.Commands.add(
  'dragTocItem',
  (
    sourceText: string,
    targetText: string,
    options: { position?: 'before' | 'after'; level?: number } = {}
  ) => {
    const { position = 'after', level } = options

    cy.getTocItem(sourceText).then(($source) => {
      const sourceId = $source.attr('data-id')
      if (!sourceId) {
        throw new Error(`Source heading "${sourceText}" does not have data-id attribute`)
      }

      cy.getTocItem(targetText).then(($target) => {
        const targetId = $target.attr('data-id')
        if (!targetId) {
          throw new Error(`Target heading "${targetText}" does not have data-id attribute`)
        }

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
        cy.get(parentSelector)
          .find('> .toc__item')
          .eq(index)
          .within(() => {
            cy.get('> a .toc__link').should('contain.text', expected.text)

            cy.root().should('have.attr', 'data-level', String(expected.level))

            if (expected.children && expected.children.length > 0) {
              cy.get('> ul.toc__list').should('exist')
              verifyItems(expected.children, '> ul.toc__list')
            }
          })
      })
    }

    cy.get('.toc__list')
      .first()
      .within(() => {
        verifyItems(expectedStructure)
      })
  }
)
