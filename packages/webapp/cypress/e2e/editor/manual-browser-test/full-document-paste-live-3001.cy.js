/**
 * Live Browser Test: Full-Document Paste Feature on port 3001
 *
 * This test performs a live browser test of the full-document paste feature
 * exactly as specified in the manual test plan.
 */

describe('Live Browser Test - Full-Document Paste (Port 3001)', () => {
  const testHTML = `<div><div>2026.2.12</div><h1>MiniMax M2.5: Built for Real-World Productivity.</h1><div>Today we are introducing our latest model, <strong>MiniMax-M2.5.</strong></div><h3>Coding</h3><div><p>In programming evaluations, MiniMax-M2.5 saw substantial improvements.</p></div><h3>Search and Tool calling</h3><div><p>Effective tool calling and search are prerequisites for autonomy.</p></div><h3>Office work</h3><div>M2.5 was trained to produce truly deliverable outputs.</div><h3>Efficiency</h3><div>Task completion speed is a practical necessity.</div><h3>Cost</h3><div>It costs just <strong>$1 to run the model continuously for an hour</strong>.</div><h3>Improvement Rate</h3><div>Over three and a half months, we released M2, M2.1, and M2.5.</div><h3>RL Scaling</h3><div>One of the key drivers is the scaling of reinforcement learning.</div><h3>Forge</h3><div>We designed an agent-native RL framework.</div><h3>Agentic RL</h3><div>On the algorithm side, we continued using CISPO.</div><h3>MiniMax Agent</h3><div>M2.5 has been fully deployed in MiniMax Agent.</div><h3>Appendix</h3><div>Further benchmark results.</div><h3>Evaluation methods</h3><div><ul><li><strong>SWE benchmark:</strong> SWE-bench Verified.</li><li><strong>BrowseComp:</strong> WebExplorer framework.</li></ul></div></div>`

  beforeEach(() => {
    cy.visit('http://localhost:3001/editor')
    cy.wait(1000)
  })

  it('COMPLETE TEST: Full workflow with detailed reporting', () => {
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

    // Step 1-3: Load editor and verify it's visible
    cy.get('.docy_editor')
      .should('be.visible')
      .then(() => {
        report.editorLoaded = true
        cy.log('✓ Step 1-3: Editor loaded and visible')
      })

    cy.get('.tiptap.ProseMirror').should('be.visible')
    cy.screenshot('01-editor-loaded')

    // Step 4: Click into editor
    cy.get('.tiptap.ProseMirror').click()
    cy.wait(300)
    cy.log('✓ Step 4: Clicked into editor')

    // Step 5-6: First paste - Select all and paste
    cy.window().then((win) => {
      const editor = win._editor
      expect(editor, 'Editor should be available at window._editor').to.exist

      cy.log('✓ Step 5: Executing selectAll() and paste')
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

    // Step 7: Wait for paste to process
    cy.wait(2000)
    cy.log('✓ Step 7: Waited 2 seconds for paste to process')

    // Step 8: Take screenshot
    cy.screenshot('02-first-paste-result')
    cy.log('✓ Step 8: Screenshot taken after first paste')

    // Step 9-10: Verify document structure
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
        headings
      }

      cy.log('✓ Step 9: First paste verification complete')
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      cy.log('FIRST PASTE STRUCTURE:')
      cy.log(JSON.stringify(report.firstPasteStructure, null, 2))
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    })

    // Step 11: Second paste - Select all again
    cy.get('.tiptap.ProseMirror').type('{cmd+a}')
    cy.wait(300)
    cy.log('✓ Step 11: Executed select all for second paste')

    // Paste again with same HTML
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
    cy.log('✓ Step 12: Waited 2 seconds after second paste')

    // Step 13: Take screenshot
    cy.screenshot('03-second-paste-result')
    cy.log('✓ Step 13: Screenshot taken after second paste')

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

      report.secondPasteStructure = {
        headingCount: headings.length,
        headings
      }

      report.headingCountsMatch =
        report.firstPasteStructure.headingCount === report.secondPasteStructure.headingCount

      cy.log('✓ Step 14: Second paste verification complete')
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      cy.log('SECOND PASTE STRUCTURE:')
      cy.log(JSON.stringify(report.secondPasteStructure, null, 2))
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Step 15: Generate comparison report
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      cy.log('FINAL REPORT - LIVE BROWSER TEST')
      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      cy.log(`✓ Editor loaded and visible: ${report.editorLoaded ? 'YES' : 'NO'}`)
      cy.log(`✓ Screenshots taken: 3 (editor-loaded, first-paste, second-paste)`)
      cy.log('')
      cy.log('HEADING STRUCTURE COMPARISON:')
      cy.log(`  First paste heading count:  ${report.firstPasteStructure.headingCount}`)
      cy.log(`  Second paste heading count: ${report.secondPasteStructure.headingCount}`)
      cy.log(`  Counts match: ${report.headingCountsMatch ? '✓ YES' : '✗ NO'}`)
      cy.log('')
      cy.log('FIRST PASTE HEADINGS (full list):')
      report.firstPasteStructure.headings.forEach((h, i) => {
        cy.log(`  ${i + 1}. H${h.level} (depth:${h.depth}): "${h.title}"`)
      })
      cy.log('')
      cy.log('SECOND PASTE HEADINGS (full list):')
      report.secondPasteStructure.headings.forEach((h, i) => {
        cy.log(`  ${i + 1}. H${h.level} (depth:${h.depth}): "${h.title}"`)
      })
      cy.log('')
      cy.log(`Console errors detected: ${report.consoleErrors.length}`)

      if (report.consoleErrors.length > 0) {
        cy.log('Console errors:')
        report.consoleErrors.forEach((error, i) => {
          cy.log(`  ${i + 1}. ${error}`)
        })
      } else {
        cy.log('  ✓ No console errors')
      }

      cy.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Write full report to file
      const fullReport = {
        timestamp: new Date().toISOString(),
        test: 'Full-Document Paste Live Browser Test (Port 3001)',
        editorUrl: 'http://localhost:3001/editor',
        results: {
          editorLoaded: report.editorLoaded,
          firstPasteHeadingCount: report.firstPasteStructure.headingCount,
          secondPasteHeadingCount: report.secondPasteStructure.headingCount,
          headingCountsMatch: report.headingCountsMatch,
          consoleErrorCount: report.consoleErrors.length,
          consoleErrors: report.consoleErrors
        },
        firstPasteStructure: report.firstPasteStructure,
        secondPasteStructure: report.secondPasteStructure
      }

      cy.writeFile('cypress/results/live-browser-test-report.json', fullReport)

      // Assertions
      expect(report.editorLoaded, 'Editor should load successfully').to.be.true
      expect(
        report.firstPasteStructure.headingCount,
        'First paste should have headings'
      ).to.be.greaterThan(0)
      expect(
        report.headingCountsMatch,
        'Heading counts should match between first and second paste'
      ).to.be.true

      // Verify heading levels match
      report.firstPasteStructure.headings.forEach((firstHeading, index) => {
        const secondHeading = report.secondPasteStructure.headings[index]
        expect(
          secondHeading?.level,
          `Heading ${index} level should match: "${firstHeading.title}"`
        ).to.equal(firstHeading.level)
        expect(secondHeading?.title, `Heading ${index} title should match`).to.equal(
          firstHeading.title
        )
      })
    })
  })
})
