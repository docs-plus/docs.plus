/// <reference types="cypress" />

type EditorWindow = {
  _editor?: import('@tiptap/core').Editor
}

type FindElementArgs = {
  editor: Element
  section?: string | number | { title: string }
  heading?: string | number | { level: number; title: string }
  paragraph?: string | number | { text: string }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      validateDomStructure(options?: {
        throwOnError?: boolean
        logResults?: boolean
      }): Chainable<{ valid: boolean; errors: string[]; structure: unknown[] }>
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
    }
  }
}

function findFirstTextNode(element: Node): Node | null {
  if (element.nodeType === Node.TEXT_NODE) return element

  for (let i = 0; i < element.childNodes.length; i++) {
    const result = findFirstTextNode(element.childNodes[i])
    if (result) return result
  }

  return null
}

function findLastTextNode(element: Node): Node | null {
  if (element.nodeType === Node.TEXT_NODE) return element

  for (let i = element.childNodes.length - 1; i >= 0; i--) {
    const result = findLastTextNode(element.childNodes[i])
    if (result) return result
  }

  return null
}

function setRangePosition(
  range: Range,
  element: Node,
  position: 'start' | 'end' | number,
  isStart: boolean
): void {
  if (element.nodeType === Node.TEXT_NODE) {
    let offset = position
    if (position === 'start') offset = 0
    else if (position === 'end') offset = element.textContent?.length || 0

    if (isStart) range.setStart(element, offset as number)
    else range.setEnd(element, offset as number)
    return
  }

  if (position === 'start') {
    const textNode = findFirstTextNode(element)
    if (textNode) {
      if (isStart) range.setStart(textNode, 0)
      else range.setEnd(textNode, 0)
    } else if (isStart) {
      range.setStart(element, 0)
    } else {
      range.setEnd(element, 0)
    }
    return
  }

  if (position === 'end') {
    const textNode = findLastTextNode(element)
    if (textNode) {
      const len = textNode.textContent?.length || 0
      if (isStart) range.setStart(textNode, len)
      else range.setEnd(textNode, len)
    } else if (isStart) {
      range.setStart(element, element.childNodes.length)
    } else {
      range.setEnd(element, element.childNodes.length)
    }
    return
  }

  if (typeof position === 'number') {
    const textNode = findFirstTextNode(element)
    if (textNode) {
      const maxPos = textNode.textContent?.length || 0
      const pos = position > maxPos ? maxPos : position
      if (isStart) range.setStart(textNode, pos)
      else range.setEnd(textNode, pos)
    } else {
      const maxPos = element.childNodes.length
      const pos = position > maxPos ? maxPos : position
      if (isStart) range.setStart(element, pos)
      else range.setEnd(element, pos)
    }
  }
}

function findElement({ editor, section, heading, paragraph }: FindElementArgs): Element {
  let element: Element = editor

  if (section) {
    const sections = Array.from(editor.querySelectorAll('h1[data-toc-id]'))
    let foundSection: Element | undefined

    if (typeof section === 'object') {
      const { title } = section
      foundSection = sections.find((s) => s.textContent?.includes(title))
    } else if (typeof section === 'number') {
      foundSection = sections[section - 1] as Element | undefined
    }

    if (!foundSection) throw new Error(`Section not found: ${JSON.stringify(section)}`)
    element = foundSection
  }

  if (heading) {
    const headings = Array.from(
      element.querySelectorAll(':is(h1, h2, h3, h4, h5, h6)[data-toc-id]')
    )
    let foundHeading: Element | undefined

    if (typeof heading === 'object') {
      const { level, title } = heading
      foundHeading = headings.find((h) => {
        const headingLevel = parseInt(h.tagName.replace('H', '') || '0')
        return (!level || headingLevel === level) && (!title || h.textContent?.includes(title))
      })
    } else if (typeof heading === 'number') {
      foundHeading = headings[heading - 1] as Element | undefined
    }

    if (!foundHeading) throw new Error(`Heading not found: ${JSON.stringify(heading)}`)
    element = foundHeading
  }

  if (paragraph) {
    const paragraphs = Array.from(element.querySelectorAll('p'))
    let foundParagraph: Element | undefined

    if (typeof paragraph === 'object') {
      const { text } = paragraph
      foundParagraph = paragraphs.find((p) => text && p.textContent?.includes(text))
    } else if (typeof paragraph === 'number') {
      foundParagraph = paragraphs[paragraph - 1] as Element | undefined
    }

    if (!foundParagraph) throw new Error(`Paragraph not found: ${JSON.stringify(paragraph)}`)
    element = foundParagraph
  }

  return element
}

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

  return cy.window().then((win) => {
    const editor = win.document.querySelector(editorSelector)
    if (!editor) throw new Error(`Editor element not found with selector: ${editorSelector}`)

    const startElement = findElement({
      editor,
      section: startSection,
      heading: startHeading,
      paragraph: startParagraph
    })

    let endElement = startElement
    if (endSection || endHeading || endParagraph) {
      endElement = findElement({
        editor,
        section: endSection,
        heading: endHeading,
        paragraph: endParagraph
      })
    }

    const selection = win.document.getSelection()
    const range = win.document.createRange()

    setRangePosition(range, startElement, startPosition, true)
    setRangePosition(range, endElement, endPosition, false)

    selection?.removeAllRanges()
    selection?.addRange(range)

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
})

Cypress.Commands.add(
  'validateDomStructure',
  (options?: { throwOnError?: boolean; logResults?: boolean }) => {
    const opts = {
      throwOnError: true,
      logResults: true,
      ...(options || {})
    }

    return cy.get('.docy_editor').then(($editor) => {
      const errors: string[] = []
      const structure: unknown[] = []

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

      const result = {
        valid: errors.length === 0,
        errors,
        structure
      }

      if (opts.logResults) {
        cy.log(`DOM Structure Validation ${result.valid ? 'PASSED' : 'FAILED'}`)
        if (!result.valid) {
          errors.forEach((error) => {
            cy.log(`ERROR: ${error}`)
          })
        }
      }

      if (opts.throwOnError && !result.valid) {
        throw new Error(`DOM Structure Validation Failed: ${errors.join(', ')}`)
      }

      return cy.wrap(result)
    })
  }
)

export {}
