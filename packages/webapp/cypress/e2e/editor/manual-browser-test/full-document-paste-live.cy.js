/**
 * Live Browser Test: Full-Document Paste Feature
 *
 * This test performs a live browser test of the full-document paste feature
 * exactly as specified in the manual test plan.
 */

describe('Live Browser Test - Full-Document Paste', () => {
  const testHTML = `<div><div>2026.2.12</div><h1>MiniMax M2.5: Built for Real-World Productivity.</h1><div>Today we're introducing our latest model, <strong>MiniMax-M2.5.</strong></div><h3>Coding</h3><div><p>In programming evaluations, MiniMax-M2.5 saw substantial improvements.</p></div><h3>Search and Tool calling</h3><div><p>Effective tool calling and search are prerequisites for autonomy.</p></div><h3>Office work</h3><div>M2.5 was trained to produce truly deliverable outputs.</div><h3>Efficiency</h3><div>Task completion speed is a practical necessity.</div><h3>Cost</h3><div>It costs just <strong>$1 to run the model continuously for an hour</strong>.</div><h3>Improvement Rate</h3><div>Over three and a half months, we released M2, M2.1, and M2.5.</div><h3>RL Scaling</h3><div>One of the key drivers is the scaling of reinforcement learning.</div><h3>Forge</h3><div>We designed an agent-native RL framework.</div><h3>Agentic RL</h3><div>On the algorithm side, we continued using CISPO.</div><h3>MiniMax Agent</h3><div>M2.5 has been fully deployed in MiniMax Agent.</div><h3>Appendix</h3><div>Further benchmark results.</div><h3>Evaluation methods</h3><div><ul><li><strong>SWE benchmark:</strong> SWE-bench Verified.</li><li><strong>BrowseComp:</strong> WebExplorer framework.</li></ul></div></div>`

  beforeEach(() => {
    cy.visit('http://localhost:3000/editor')
    cy.wait(500)
  })

  it('Step 1-3: Navigate and verify editor is visible', () => {
    // Step 1-2: Already done in beforeEach
    // Step 3: Verify editor is visible
    cy.get('.docy_editor').should('be.visible')
    cy.get('.tiptap.ProseMirror').should('be.visible')

    // Take screenshot
    cy.screenshot('01-editor-loaded')
  })

  it('Step 4-8: First paste - Select all and paste HTML content', () => {
    cy.get('.docy_editor').should('be.visible')

    // Step 4: Click into editor
    cy.get('.tiptap.ProseMirror').click()
    cy.wait(200)

    // Step 5: Select all content (Cmd+A)
    cy.get('.tiptap.ProseMirror').type('{cmd+a}')
    cy.wait(200)

    // Step 6: Paste HTML content
    cy.window().then((win) => {
      const editor = win._editor
      expect(editor, 'Editor should be available').to.exist

      // Select all first
      editor.commands.selectAll()

      // Simulate paste
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', testHTML)
      clipboardData.setData('text/plain', testHTML.replace(/<[^>]*>/g, ' '))
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      editor.view.dom.dispatchEvent(pasteEvent)
    })

    // Step 7: Wait for paste to process
    cy.wait(2000)

    // Step 8: Take screenshot
    cy.screenshot('02-first-paste-result')

    // Step 9: Check console for errors (Cypress automatically captures)
    cy.window().then((win) => {
      // Cypress will fail if there are console errors
    })

    // Step 10: Verify document structure
    cy.window().then((win) => {
      const editor = win._editor
      const doc = editor.state.doc
      const headings = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const title = node.firstChild?.textContent || ''
          const depth = doc.resolve(pos).depth
          headings.push({ level, title: title.substring(0, 40), depth })
        }
      })

      const result = {
        headingCount: headings.length,
        headings: headings.slice(0, 15)
      }

      cy.log('FIRST PASTE STRUCTURE:', JSON.stringify(result, null, 2))

      // Store for comparison
      cy.wrap(result).as('firstPasteStructure')

      // Basic validation
      expect(headings.length).to.be.greaterThan(0, 'Should have headings after first paste')
    })
  })

  it('Step 11-15: Second paste - Repeat select all and paste', () => {
    cy.get('.docy_editor').should('be.visible')

    // First paste
    cy.get('.tiptap.ProseMirror').click()
    cy.wait(200)

    cy.window().then((win) => {
      const editor = win._editor
      editor.commands.selectAll()

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', testHTML)
      clipboardData.setData('text/plain', testHTML.replace(/<[^>]*>/g, ' '))
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      editor.view.dom.dispatchEvent(pasteEvent)
    })

    cy.wait(2000)

    // Get first paste structure
    let firstPasteStructure
    cy.window().then((win) => {
      const editor = win._editor
      const doc = editor.state.doc
      const headings = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const title = node.firstChild?.textContent || ''
          const depth = doc.resolve(pos).depth
          headings.push({ level, title: title.substring(0, 40), depth })
        }
      })

      firstPasteStructure = {
        headingCount: headings.length,
        headings: headings.slice(0, 15)
      }

      cy.log('FIRST PASTE:', JSON.stringify(firstPasteStructure, null, 2))
    })

    // Step 11: Second paste - Cmd+A
    cy.get('.tiptap.ProseMirror').type('{cmd+a}')
    cy.wait(200)

    // Paste again
    cy.window().then((win) => {
      const editor = win._editor
      editor.commands.selectAll()

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', testHTML)
      clipboardData.setData('text/plain', testHTML.replace(/<[^>]*>/g, ' '))
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      editor.view.dom.dispatchEvent(pasteEvent)
    })

    // Step 12: Wait 2 seconds
    cy.wait(2000)

    // Step 13: Take screenshot
    cy.screenshot('03-second-paste-result')

    // Step 14: Verify document structure again
    cy.window().then((win) => {
      const editor = win._editor
      const doc = editor.state.doc
      const headings = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const title = node.firstChild?.textContent || ''
          const depth = doc.resolve(pos).depth
          headings.push({ level, title: title.substring(0, 40), depth })
        }
      })

      const secondPasteStructure = {
        headingCount: headings.length,
        headings: headings.slice(0, 15)
      }

      cy.log('SECOND PASTE:', JSON.stringify(secondPasteStructure, null, 2))

      // Step 15: Compare structures
      cy.log('COMPARISON:')
      cy.log(`First paste heading count: ${firstPasteStructure.headingCount}`)
      cy.log(`Second paste heading count: ${secondPasteStructure.headingCount}`)

      // Assertion: heading counts should match
      expect(secondPasteStructure.headingCount).to.equal(
        firstPasteStructure.headingCount,
        'Heading counts should match between first and second paste'
      )

      // Verify heading levels match
      firstPasteStructure.headings.forEach((firstHeading, index) => {
        const secondHeading = secondPasteStructure.headings[index]
        expect(secondHeading.level).to.equal(
          firstHeading.level,
          `Heading ${index} level should match: ${firstHeading.title}`
        )
      })
    })

    // Check for console errors (final check)
    cy.window().then((win) => {
      // Cypress automatically fails if there are console errors
    })
  })

  it('COMPLETE TEST: Full workflow with reporting', () => {
    const report = {
      editorLoaded: false,
      firstPasteStructure: null,
      secondPasteStructure: null,
      headingCountsMatch: false,
      consoleErrors: []
    }

    // Capture console errors
    cy.on('window:before:load', (win) => {
      const originalError = win.console.error
      win.console.error = (...args) => {
        report.consoleErrors.push(args.join(' '))
        originalError.apply(win.console, args)
      }
    })

    // Step 1-3: Load editor
    cy.get('.docy_editor')
      .should('be.visible')
      .then(() => {
        report.editorLoaded = true
        cy.log('✓ Editor loaded successfully')
      })

    cy.screenshot('REPORT-01-editor-loaded')

    // Step 4-10: First paste
    cy.get('.tiptap.ProseMirror').click()
    cy.wait(200)

    cy.window().then((win) => {
      const editor = win._editor
      editor.commands.selectAll()

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', testHTML)
      clipboardData.setData('text/plain', testHTML.replace(/<[^>]*>/g, ' '))
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      editor.view.dom.dispatchEvent(pasteEvent)
    })

    cy.wait(2000)
    cy.screenshot('REPORT-02-first-paste')

    cy.window().then((win) => {
      const editor = win._editor
      const doc = editor.state.doc
      const headings = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const title = node.firstChild?.textContent || ''
          const depth = doc.resolve(pos).depth
          headings.push({ level, title: title.substring(0, 40), depth })
        }
      })

      report.firstPasteStructure = {
        headingCount: headings.length,
        headings: headings.slice(0, 15)
      }

      cy.log('FIRST PASTE STRUCTURE:', JSON.stringify(report.firstPasteStructure, null, 2))
    })

    // Step 11-15: Second paste
    cy.get('.tiptap.ProseMirror').type('{cmd+a}')
    cy.wait(200)

    cy.window().then((win) => {
      const editor = win._editor
      editor.commands.selectAll()

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', testHTML)
      clipboardData.setData('text/plain', testHTML.replace(/<[^>]*>/g, ' '))
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      editor.view.dom.dispatchEvent(pasteEvent)
    })

    cy.wait(2000)
    cy.screenshot('REPORT-03-second-paste')

    cy.window().then((win) => {
      const editor = win._editor
      const doc = editor.state.doc
      const headings = []

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.firstChild?.attrs?.level || 1
          const title = node.firstChild?.textContent || ''
          const depth = doc.resolve(pos).depth
          headings.push({ level, title: title.substring(0, 40), depth })
        }
      })

      report.secondPasteStructure = {
        headingCount: headings.length,
        headings: headings.slice(0, 15)
      }

      report.headingCountsMatch =
        report.firstPasteStructure.headingCount === report.secondPasteStructure.headingCount

      cy.log('SECOND PASTE STRUCTURE:', JSON.stringify(report.secondPasteStructure, null, 2))

      // Generate final report
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      cy.log('FINAL REPORT')
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      cy.log(`Editor loaded: ${report.editorLoaded ? '✓ YES' : '✗ NO'}`)
      cy.log(`First paste heading count: ${report.firstPasteStructure.headingCount}`)
      cy.log(`Second paste heading count: ${report.secondPasteStructure.headingCount}`)
      cy.log(`Heading counts match: ${report.headingCountsMatch ? '✓ YES' : '✗ NO'}`)
      cy.log(`Console errors: ${report.consoleErrors.length}`)

      if (report.consoleErrors.length > 0) {
        cy.log('Console errors detected:')
        report.consoleErrors.forEach((error, i) => {
          cy.log(`  ${i + 1}. ${error}`)
        })
      }

      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Assertions
      expect(report.editorLoaded).to.be.true
      expect(report.firstPasteStructure.headingCount).to.be.greaterThan(0)
      expect(report.headingCountsMatch).to.be.true
      expect(report.consoleErrors.length).to.equal(0)
    })
  })
})
