/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const ROOT = '.docy_editor .heading[level="1"] .contentWrapper > .contents'
const BULLET_ITEMS = `${ROOT} > ul:not([data-type="taskList"]) > li`
const ORDERED_ITEMS = `${ROOT} > ol > li`
const TASK_ITEMS_TOP = `${ROOT} > ul[data-type="taskList"] > li`
const TASK_ITEMS_ALL = `${ROOT} ul[data-type="taskList"] li`

const selectItemRange = (startText, endText = startText) =>
  cy.createSelection({
    startSection: 1,
    startParagraph: { text: startText },
    startPosition: 'start',
    endSection: 1,
    endParagraph: { text: endText },
    endPosition: 'end'
  })

const selectListNodeRangeInEditor = (startText, endText, nodeTypeName) => {
  cy.window().then((win) => {
    const editor = win._editor
    let from = null
    let to = null

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== nodeTypeName) return

      // For list nodes, match against the primary paragraph label only to avoid
      // parent textContent containing nested descendants.
      const directLabel =
        node.firstChild?.type?.name === 'paragraph' ? node.firstChild.textContent : node.textContent

      if (from === null && directLabel.includes(startText)) {
        from = pos
      }
      if (directLabel.includes(endText)) {
        to = pos + node.nodeSize
      }
    })

    if (from === null || to === null) {
      throw new Error(`Unable to resolve ${nodeTypeName} range for "${startText}" -> "${endText}"`)
    }

    editor.chain().focus().setTextSelection({ from, to }).run()
  })
}

const copySelectionSlice = (aliasName) => {
  cy.window().then((win) => {
    const editor = win._editor
    const slice = editor.state.selection.content()
    cy.wrap(slice).as(aliasName.replace(/^@/, ''))
  })
}

const cutSelectionInEditor = () => {
  cy.window().then((win) => {
    const editor = win._editor
    const { from, to } = editor.state.selection
    editor.view.dispatch(editor.state.tr.delete(from, to))
  })
}

const pasteSliceAtCurrentSelection = (aliasName) => {
  cy.get(aliasName).then((slice) => {
    cy.window().then((win) => {
      const editor = win._editor
      editor.view.dispatch(editor.state.tr.replaceSelection(slice))
    })
  })
}

const createListItems = (shortcut, itemSelector, items) => {
  cy.get(`${ROOT} > p`).first().click()
  cy.get('.docy_editor').realPress(shortcut)

  items.forEach((item, index) => {
    if (index > 0) {
      cy.get(itemSelector)
        .eq(index - 1)
        .realPress('Enter')
    }
    cy.get(itemSelector).eq(index).realType(item)
  })
}

const createTaskListItemsWithDepth = (items) => {
  if (!items.length) return

  const rootItems = []
  const parentStack = []

  items.forEach((item) => {
    const targetIndent = item.indent || 0

    while (parentStack.length > targetIndent) {
      parentStack.pop()
    }

    const taskItemNode = {
      type: 'taskItem',
      attrs: { checked: false },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item.text }] }]
    }

    if (targetIndent === 0 || parentStack.length === 0) {
      rootItems.push(taskItemNode)
    } else {
      const parent = parentStack[parentStack.length - 1]
      let nestedList = parent.content.find((child) => child.type === 'taskList')
      if (!nestedList) {
        nestedList = { type: 'taskList', content: [] }
        parent.content.push(nestedList)
      }
      nestedList.content.push(taskItemNode)
    }

    parentStack[targetIndent] = taskItemNode
    parentStack.length = targetIndent + 1
  })

  cy.get(`${ROOT} > p`).first().click()
  cy.window().then((win) => {
    const editor = win._editor
    editor.chain().focus().insertContent({ type: 'taskList', content: rootItems }).run()
  })
}

const applyFormattingAndHyperlink = (itemText, shortcuts, href) => {
  selectItemRange(itemText)
  shortcuts.forEach((shortcut) => {
    cy.get('.docy_editor').realPress(shortcut)
  })

  // Use the real hyperlink command path so tests validate the same behavior users trigger.
  selectItemRange(itemText)
  cy.get('.docy_editor').realPress(['Meta', 'k'])
  cy.get('.hyperlinkCreatePopover').should('be.visible')
  cy.get('.hyperlinkCreatePopover input[name="hyperlink-url"]').clear().type(href)
  cy.get('.hyperlinkCreatePopover button[type="submit"]').click()
}

const pasteSliceAtListEnd = (itemSelector, aliasName) => {
  cy.get(itemSelector).last().click().realPress('End').realPress('Enter')
  pasteSliceAtCurrentSelection(aliasName)
}

const assertTaskItemsRemainNested = (parentText, childTexts) => {
  cy.window().then((win) => {
    const editor = win._editor
    const { doc } = editor.state

    const findTaskItemDepthByText = (text) => {
      let depth = null
      doc.descendants((node, pos) => {
        if (node.type.name !== 'taskItem') return
        const directLabel =
          node.firstChild?.type?.name === 'paragraph'
            ? node.firstChild.textContent
            : node.textContent
        if (directLabel !== text) return

        depth = doc.resolve(pos).depth
        return false
      })
      return depth
    }

    const parentDepth = findTaskItemDepthByText(parentText)
    expect(parentDepth, `Unable to find parent task "${parentText}"`).to.not.equal(null)

    childTexts.forEach((childText) => {
      const childDepth = findTaskItemDepthByText(childText)
      expect(childDepth, `Unable to find child task "${childText}"`).to.not.equal(null)
      expect(
        childDepth,
        `Expected "${childText}" to remain nested under "${parentText}"`
      ).to.be.greaterThan(parentDepth)
    })
  })
}

describe('List Clipboard Combinations', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'list-clipboard-combinations' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  it('copies several bullet items with mixed formatting + links and pastes them back into the list', () => {
    const items = [
      'ALPHA bold-link item',
      'BETA italic-underline-link item',
      'GAMMA strike-highlight-code-link item',
      'TAIL destination item'
    ]

    createListItems(['Meta', 'Shift', '8'], BULLET_ITEMS, items)

    applyFormattingAndHyperlink(items[0], [['Meta', 'b']], 'https://alpha.example')
    applyFormattingAndHyperlink(
      items[1],
      [
        ['Meta', 'i'],
        ['Meta', 'u']
      ],
      'https://beta.example'
    )
    applyFormattingAndHyperlink(
      items[2],
      [
        ['Meta', 'Shift', 's'],
        ['Meta', 'Shift', 'h'],
        ['Meta', 'e']
      ],
      'https://gamma.example'
    )

    cy.get(`${ROOT} a[href="https://alpha.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://beta.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://gamma.example"]`).should('have.length', 1)

    selectListNodeRangeInEditor(items[0], items[2], 'listItem')
    copySelectionSlice('@copiedBulletSlice')
    pasteSliceAtListEnd(BULLET_ITEMS, '@copiedBulletSlice')

    cy.get(BULLET_ITEMS).should('have.length', 7)
    cy.get(`${ROOT} a[href="https://alpha.example"]`).should('have.length', 2)
    cy.get(`${ROOT} a[href="https://beta.example"]`).should('have.length', 2)
    cy.get(`${ROOT} a[href="https://gamma.example"]`).should('have.length', 2)

    cy.get(`${ROOT} strong`).filter(':contains("ALPHA")').should('have.length', 2)
    cy.get(`${ROOT} em`).filter(':contains("BETA")').should('have.length', 2)
    cy.get(`${ROOT} u`).filter(':contains("BETA")').should('have.length', 2)
    cy.get(`${ROOT} s`).filter(':contains("GAMMA")').should('have.length', 2)
    cy.get(`${ROOT} mark`).filter(':contains("GAMMA")').should('have.length', 2)
    cy.get(`${ROOT} code`).filter(':contains("GAMMA")').should('have.length', 2)
    cy.assertFullSchemaValid()
  })

  it('cuts several ordered items with mixed formatting + links and pastes them back into the list', () => {
    const items = [
      'KEEP-ONE ordered item',
      'CUT-ALPHA bold-link item',
      'CUT-BETA italic-underline-link item',
      'CUT-GAMMA strike-highlight-link item',
      'KEEP-TWO ordered item'
    ]

    createListItems(['Meta', 'Shift', '7'], ORDERED_ITEMS, items)

    applyFormattingAndHyperlink(items[1], [['Meta', 'b']], 'https://cut-alpha.example')
    applyFormattingAndHyperlink(
      items[2],
      [
        ['Meta', 'i'],
        ['Meta', 'u']
      ],
      'https://cut-beta.example'
    )
    applyFormattingAndHyperlink(
      items[3],
      [
        ['Meta', 'Shift', 's'],
        ['Meta', 'Shift', 'h']
      ],
      'https://cut-gamma.example'
    )

    cy.get(`${ROOT} a[href="https://cut-alpha.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://cut-beta.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://cut-gamma.example"]`).should('have.length', 1)

    selectListNodeRangeInEditor(items[1], items[3], 'listItem')
    copySelectionSlice('@cutOrderedSlice')
    cutSelectionInEditor()

    cy.get(ORDERED_ITEMS).its('length').should('be.lessThan', 5)
    cy.get(ORDERED_ITEMS).should('not.contain', 'CUT-ALPHA')
    cy.get(ORDERED_ITEMS).should('not.contain', 'CUT-BETA')
    cy.get(ORDERED_ITEMS).should('not.contain', 'CUT-GAMMA')

    pasteSliceAtListEnd(ORDERED_ITEMS, '@cutOrderedSlice')

    cy.get(ORDERED_ITEMS).should('have.length', 5)
    cy.get(`${ROOT} a[href="https://cut-alpha.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://cut-beta.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://cut-gamma.example"]`).should('have.length', 1)
    cy.get(`${ROOT} strong`).filter(':contains("CUT-ALPHA")').should('have.length', 1)
    cy.get(`${ROOT} em`).filter(':contains("CUT-BETA")').should('have.length', 1)
    cy.get(`${ROOT} u`).filter(':contains("CUT-BETA")').should('have.length', 1)
    cy.get(`${ROOT} s`).filter(':contains("CUT-GAMMA")').should('have.length', 1)
    cy.get(`${ROOT} mark`).filter(':contains("CUT-GAMMA")').should('have.length', 1)
    cy.assertFullSchemaValid()
  })

  it('copies nested task items with mixed formatting + links and pastes them back with depth preserved', () => {
    const items = [
      { text: 'TASK-ROOT-ALPHA bold-link item', indent: 0 },
      { text: 'TASK-CHILD-BETA italic-underline-link item', indent: 1 },
      { text: 'TASK-CHILD-GAMMA strike-highlight-link item', indent: 1 },
      { text: 'TASK-ROOT-TAIL destination item', indent: 0 }
    ]

    createTaskListItemsWithDepth(items)

    applyFormattingAndHyperlink(items[0].text, [['Meta', 'b']], 'https://task-alpha.example')
    applyFormattingAndHyperlink(
      items[1].text,
      [
        ['Meta', 'i'],
        ['Meta', 'u']
      ],
      'https://task-beta.example'
    )
    applyFormattingAndHyperlink(
      items[2].text,
      [
        ['Meta', 'Shift', 's'],
        ['Meta', 'Shift', 'h']
      ],
      'https://task-gamma.example'
    )

    cy.get(`${ROOT} a[href="https://task-alpha.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://task-beta.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://task-gamma.example"]`).should('have.length', 1)

    selectListNodeRangeInEditor(items[0].text, items[2].text, 'taskItem')
    copySelectionSlice('@copiedTaskSlice')
    pasteSliceAtListEnd(TASK_ITEMS_TOP, '@copiedTaskSlice')

    cy.get(TASK_ITEMS_ALL).should('have.length', 7)
    assertTaskItemsRemainNested(items[0].text, [items[1].text, items[2].text])
    cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]`).should('have.length', 7)
    cy.get(`${ROOT} a[href="https://task-alpha.example"]`).should('have.length', 2)
    cy.get(`${ROOT} a[href="https://task-beta.example"]`).should('have.length', 2)
    cy.get(`${ROOT} a[href="https://task-gamma.example"]`).should('have.length', 2)
    cy.get(`${ROOT} strong`).filter(':contains("TASK-ROOT-ALPHA")').should('have.length', 2)
    cy.get(`${ROOT} em`).filter(':contains("TASK-CHILD-BETA")').should('have.length', 2)
    cy.get(`${ROOT} u`).filter(':contains("TASK-CHILD-BETA")').should('have.length', 2)
    cy.get(`${ROOT} s`).filter(':contains("TASK-CHILD-GAMMA")').should('have.length', 2)
    cy.get(`${ROOT} mark`).filter(':contains("TASK-CHILD-GAMMA")').should('have.length', 2)
    cy.assertFullSchemaValid()
  })

  it('cuts nested task items with mixed formatting + links and pastes them back into the list', () => {
    const items = [
      { text: 'TASK-KEEP-ROOT-ONE', indent: 0 },
      { text: 'TASK-CUT-ROOT-ALPHA bold-link item', indent: 0 },
      { text: 'TASK-CUT-CHILD-BETA italic-underline-link item', indent: 1 },
      { text: 'TASK-CUT-CHILD-GAMMA strike-highlight-link item', indent: 1 },
      { text: 'TASK-KEEP-ROOT-TWO', indent: 0 }
    ]

    createTaskListItemsWithDepth(items)

    applyFormattingAndHyperlink(items[1].text, [['Meta', 'b']], 'https://task-cut-alpha.example')
    applyFormattingAndHyperlink(
      items[2].text,
      [
        ['Meta', 'i'],
        ['Meta', 'u']
      ],
      'https://task-cut-beta.example'
    )
    applyFormattingAndHyperlink(
      items[3].text,
      [
        ['Meta', 'Shift', 's'],
        ['Meta', 'Shift', 'h']
      ],
      'https://task-cut-gamma.example'
    )

    cy.get(`${ROOT} a[href="https://task-cut-alpha.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://task-cut-beta.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://task-cut-gamma.example"]`).should('have.length', 1)

    selectListNodeRangeInEditor(items[1].text, items[3].text, 'taskItem')
    copySelectionSlice('@cutTaskSlice')
    cutSelectionInEditor()

    cy.get(TASK_ITEMS_ALL).its('length').should('be.lessThan', 5)
    cy.get(TASK_ITEMS_ALL).should('not.contain', 'TASK-CUT-ROOT-ALPHA')
    cy.get(TASK_ITEMS_ALL).should('not.contain', 'TASK-CUT-CHILD-BETA')
    cy.get(TASK_ITEMS_ALL).should('not.contain', 'TASK-CUT-CHILD-GAMMA')

    pasteSliceAtListEnd(TASK_ITEMS_TOP, '@cutTaskSlice')

    cy.get(TASK_ITEMS_ALL).should('have.length', 5)
    assertTaskItemsRemainNested(items[1].text, [items[2].text, items[3].text])
    cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]`).should('have.length', 5)
    cy.get(`${ROOT} a[href="https://task-cut-alpha.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://task-cut-beta.example"]`).should('have.length', 1)
    cy.get(`${ROOT} a[href="https://task-cut-gamma.example"]`).should('have.length', 1)
    cy.get(`${ROOT} strong`).filter(':contains("TASK-CUT-ROOT-ALPHA")').should('have.length', 1)
    cy.get(`${ROOT} em`).filter(':contains("TASK-CUT-CHILD-BETA")').should('have.length', 1)
    cy.get(`${ROOT} u`).filter(':contains("TASK-CUT-CHILD-BETA")').should('have.length', 1)
    cy.get(`${ROOT} s`).filter(':contains("TASK-CUT-CHILD-GAMMA")').should('have.length', 1)
    cy.get(`${ROOT} mark`).filter(':contains("TASK-CUT-CHILD-GAMMA")').should('have.length', 1)
    cy.assertFullSchemaValid()
  })
})
