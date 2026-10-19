/// <reference types="cypress" />

import type { Editor, JSONContent } from '@tiptap/core'
import { closeHistory, undo } from '@tiptap/pm/history'

// Failure modes: blocks swap state, or one block's type, error or timer leaks into another.
// An edit or delete redraws a neighbour. A round trip or paste loses a source byte or a
// diagram. Blocks draw only near the viewport, so each state check scrolls its block first.

const ROOT = '.mermaid-diagram'
const VIEW = '.mermaid-diagram > [data-state]'

const FLOW = 'flowchart LR\n  Plan[Plan step] --> Build[Build step]'
const SEQ = 'sequenceDiagram\n  Alice->>Bob: Ping message'
const STATE = 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy'
const CLASS = 'classDiagram\n  Shape <|-- Circle'
const ER = 'erDiagram\n  CUSTOMER ||--o{ ORDER : places'
const GANTT =
  'gantt\n  title Launch plan\n  dateFormat YYYY-MM-DD\n  section Build\n  Write code :a1, 2026-01-01, 3d'
const PIE = 'pie title Pets\n  "Dogs" : 40\n  "Cats" : 60'
const MINDMAP = 'mindmap\n  root((Docs))\n    Write\n    Ship'
const TIMELINE = 'timeline\n  title History\n  2024 : Start\n  2025 : Grow'
const JS = 'const graph = "flowchart LR\\n  A --> B"\nconsole.log(graph)'

const TYPED: [string, string][] = [
  [FLOW, 'flowchart'],
  [SEQ, 'sequence'],
  [STATE, 'state'],
  [CLASS, 'class'],
  [ER, 'er'],
  [GANTT, 'gantt'],
  [PIE, 'pie'],
  [MINDMAP, 'mindmap'],
  [TIMELINE, 'timeline']
]
const TYPES = TYPED.map(([, type]) => type)

const LEFT = 'flowchart LR\n  L1[Left one] --> L2[Left two]'
const RIGHT = 'flowchart LR\n  R1[Right one] --> R2[Right two]'
const BROKEN = 'flowchart LR\n  M1[Middle] -->'
const FIXED = 'flowchart LR\n  M1[Middle] --> M2[Fixed]'

const alpha = (label: string): string => `flowchart LR\n  A[Alpha ${label}]`
const beta = (label: string): string => `flowchart LR\n  B[Beta ${label}]`

// Comments, deep and tab indents, quotes, an ampersand and right-to-left text with emoji.
const COMMENTED =
  "%% top comment\nflowchart TD\n  %% inner comment\n    A[\"Say 'hi' & go\"] --> B[it's fine]\n\tB --> C[Done]"
const UNICODE = 'flowchart RL\n  A["سلام دنیا 👋"] -->|"پیوند"| B["نمودار 🎉"]'
const TILDE = 'sequenceDiagram\n  Ana->>Ben: Tilde fence'
const MARKDOWN_SOURCES = [COMMENTED, UNICODE, CLASS, TILDE, '']
const MARKDOWN = [
  '# Release notes',
  '',
  'Intro paragraph.',
  '',
  '```mermaid',
  COMMENTED,
  '```',
  '',
  '## نمودار',
  '',
  '```mermaid',
  UNICODE,
  '```',
  '',
  '```js',
  JS,
  '```',
  '',
  '```mermaid',
  CLASS,
  '```',
  '',
  '~~~mermaid',
  TILDE,
  '~~~',
  '',
  '```mermaid',
  '```',
  '',
  'Closing paragraph.'
].join('\n')

const text = (value: string): JSONContent[] => (value ? [{ type: 'text', text: value }] : [])
const heading = (value: string, level = 2): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: text(value)
})
const para = (value: string): JSONContent => ({ type: 'paragraph', content: text(value) })
const code = (source: string, language = 'mermaid'): JSONContent => ({
  type: 'codeBlock',
  attrs: { language },
  content: text(source)
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

function setDoc(content: JSONContent): void {
  cy.getEditor().then((editor) => {
    editor.commands.setContent(content)
  })
}

function mermaidRanges(editor: Editor): { pos: number; from: number; to: number }[] {
  const ranges: { pos: number; from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock' && node.attrs.language === 'mermaid') {
      ranges.push({ pos, from: pos + 1, to: pos + node.nodeSize - 1 })
    }
    return true
  })
  return ranges
}

function mermaidSources(editor: Editor): string[] {
  const sources: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock' && node.attrs.language === 'mermaid') {
      sources.push(node.textContent)
    }
    return true
  })
  return sources
}

// Changes one block's text in place, so its node view takes the update path.
function replaceSource(index: number, source: string): void {
  cy.getEditor().then((editor) => replaceNow(editor, index, source))
}

function replaceNow(editor: Editor, index: number, source: string): void {
  const { from, to } = mermaidRanges(editor)[index]
  editor
    .chain()
    .command(({ tr }) => {
      tr.replaceWith(from, to, editor.schema.text(source))
      return true
    })
    .setTextSelection(from + source.length)
    .run()
}

function expectState(index: number, state: string): void {
  cy.get(ROOT).eq(index).scrollIntoView()
  cy.get(VIEW).eq(index).should('have.attr', 'data-state', state)
}

function expectAllStates(states: string[]): void {
  cy.get(ROOT).should('have.length', states.length)
  states.forEach((state, index) => expectState(index, state))
}

function svgAt(index: number): Cypress.Chainable<JQuery<SVGElement>> {
  return cy.get(VIEW).eq(index).find('svg.pele')
}

describe('mermaid — complex documents', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visitPlayground()
  })

  it('draws nine diagram types in one document, each with its own type and source', () => {
    const [flow, seq, state, cls, er, gantt, pie, mindmap, timeline] = TYPED.map(([s]) => code(s))
    setDoc(
      doc(
        heading('Plan', 1),
        para('Overview'),
        flow,
        heading('Talk'),
        seq,
        para('Between diagrams'),
        state,
        cls,
        code(JS, 'js'),
        er,
        heading('Schedule'),
        gantt,
        pie,
        para('Notes'),
        mindmap,
        timeline,
        para('End')
      )
    )
    expectAllStates(TYPES.map(() => 'ready'))
    TYPED.forEach(([source, type], index) => {
      cy.get(ROOT).eq(index).find('.mermaid-diagram__source pre').should('have.text', source)
      svgAt(index)
        .should('have.length', 1)
        .and(($svg) => {
          for (const other of TYPES) {
            expect($svg.hasClass(`pele-${other}`), `block ${index} pele-${other}`).to.equal(
              other === type
            )
          }
        })
    })
    cy.get('#editor pre')
      .not(`${ROOT} pre`)
      .should('have.length', 1)
      .and('have.text', JS)
      .closest(ROOT)
      .should('not.exist')
    cy.get('#editor svg.pele').should('have.length', TYPES.length)
  })

  it('keeps a broken diagram from touching its neighbours, then draws it once fixed', () => {
    setDoc(
      doc(code(LEFT), para('Between'), code(BROKEN), para('Between'), code(RIGHT), para('End'))
    )
    expectAllStates(['ready', 'error', 'ready'])
    cy.get(VIEW).eq(1).find('.mermaid-diagram__message').should('be.visible')
    for (const index of [0, 2]) {
      cy.get(VIEW).eq(index).find('.mermaid-diagram__error').should('not.be.visible')
      svgAt(index).should('have.css', 'opacity', '1')
    }

    const seen: string[] = []
    const kept: Element[] = []
    cy.get(VIEW).then(($views) => {
      for (const index of [0, 2]) {
        const view = $views[index]
        kept.push(view.querySelector('svg.pele')!)
        new MutationObserver(() => seen.push(view.dataset.state!)).observe(view, {
          attributeFilter: ['data-state']
        })
      }
    })

    replaceSource(1, FIXED)
    expectState(1, 'ready')
    svgAt(1).should('contain.text', 'Fixed')
    cy.get(VIEW).eq(1).find('.mermaid-diagram__error').should('not.be.visible')
    expectAllStates(['ready', 'ready', 'ready'])
    cy.get(VIEW).then(($views) => {
      expect(seen).to.not.include('error')
      expect($views[0].querySelector('svg.pele')).to.equal(kept[0])
      expect($views[2].querySelector('svg.pele')).to.equal(kept[1])
    })
  })

  it('keeps one redraw timer per block, so each ends on its own latest source', () => {
    setDoc(doc(code(alpha('one')), para('Between'), code(beta('one')), para('End')))
    expectAllStates(['ready', 'ready'])
    svgAt(0).should('contain.text', 'Alpha one')
    svgAt(1).should('contain.text', 'Beta one')

    cy.clock()
    replaceSource(0, alpha('two'))
    cy.tick(100)
    replaceSource(1, beta('two'))
    cy.tick(200)
    // A shared timer would have been pushed back by B's edit, or would have drawn B too.
    svgAt(0).should('contain.text', 'Alpha two')
    svgAt(1).should('contain.text', 'Beta one')

    replaceSource(0, alpha('three'))
    cy.tick(100)
    svgAt(1).should('contain.text', 'Beta two')
    svgAt(0).should('contain.text', 'Alpha two')

    cy.tick(200)
    svgAt(0).should('contain.text', 'Alpha three').and('not.contain.text', 'Alpha two')
    svgAt(1).should('contain.text', 'Beta two').and('not.contain.text', 'Beta one')
    cy.get('#editor').should('not.contain.text', 'Alpha one').and('not.contain.text', 'Beta one')
    expectAllStates(['ready', 'ready'])
  })

  it('keeps every mermaid source byte for byte through a markdown round trip', () => {
    cy.setMarkdown(MARKDOWN)
    expectAllStates(['ready', 'ready', 'ready', 'ready', 'empty'])
    cy.getEditor().should((editor) => {
      expect(mermaidSources(editor)).to.deep.equal(MARKDOWN_SOURCES)
    })
    cy.get('#editor pre').not(`${ROOT} pre`).should('have.text', JS)

    cy.getMarkdown().then((first) => {
      for (const source of MARKDOWN_SOURCES) {
        // An empty source exports one blank line, and the next import reads it back as empty.
        expect(first).to.include('```mermaid\n' + source + '\n```')
      }
      expect(first).to.include('```js\n' + JS + '\n```')
      expect(first).to.not.include('~~~')

      // Clear first, so a no-op import cannot pass on the old content.
      cy.setMarkdown('reset')
      cy.get(ROOT).should('not.exist')
      cy.setMarkdown(first)
      cy.getEditor().should((editor) => {
        expect(mermaidSources(editor)).to.deep.equal(MARKDOWN_SOURCES)
      })
      cy.getMarkdown().should('equal', first)
    })
  })

  it('keeps every source and no SVG through an HTML round trip, then redraws all', () => {
    cy.setMarkdown(MARKDOWN)
    expectAllStates(['ready', 'ready', 'ready', 'ready', 'empty'])
    cy.getEditor().then((editor) => {
      const html = editor.getHTML()
      expect(html).to.not.include('<svg')
      expect(html).to.not.include('pele')
      editor.commands.setContent('<p>reset</p>')
      expect(mermaidSources(editor)).to.deep.equal([])
      editor.commands.setContent(html)
      expect(mermaidSources(editor)).to.deep.equal(MARKDOWN_SOURCES)
    })
    expectAllStates(['ready', 'ready', 'ready', 'ready', 'empty'])
    svgAt(1).should('contain.text', 'سلام دنیا 👋')
    svgAt(0).should('contain.text', "Say 'hi' & go")
  })

  it('leaves the other diagrams drawn when one is deleted, and redraws it on undo', () => {
    setDoc(doc(code(LEFT), para('One'), code(FLOW), para('Two'), code(RIGHT), para('End')))
    expectAllStates(['ready', 'ready', 'ready'])

    const kept: Element[] = []
    cy.get(VIEW).then(($views) => {
      kept.push($views[0].querySelector('svg.pele')!, $views[2].querySelector('svg.pele')!)
    })

    // The test deletes within 500 ms of setContent. History would merge the two, and undo
    // would then remove the whole document.
    cy.getEditor().then((editor) => {
      editor
        .chain()
        .command(({ tr }) => {
          closeHistory(tr)
          return true
        })
        .setNodeSelection(mermaidRanges(editor)[1].pos)
        .deleteSelection()
        .run()
      expect(mermaidSources(editor)).to.deep.equal([LEFT, RIGHT])
    })
    cy.get(ROOT).should('have.length', 2)
    cy.get(VIEW).should(($views) => {
      expect($views[0].dataset.state).to.equal('ready')
      expect($views[1].dataset.state).to.equal('ready')
      expect($views[0].querySelector('svg.pele')).to.equal(kept[0])
      expect($views[1].querySelector('svg.pele')).to.equal(kept[1])
    })

    cy.getEditor().then((editor) => {
      expect(undo(editor.state, editor.view.dispatch)).to.equal(true)
      expect(mermaidSources(editor)).to.deep.equal([LEFT, FLOW, RIGHT])
    })
    expectAllStates(['ready', 'ready', 'ready'])
    svgAt(1).should('contain.text', 'Plan step')
  })

  it('starts every block folded and drawn in a read-only document', () => {
    cy.visitPlayground('?readonly')
    setDoc(
      doc(
        heading('Read only', 1),
        code(FLOW),
        para('Between'),
        code(SEQ),
        code(STATE),
        para('Between'),
        code(PIE)
      )
    )
    expectAllStates(['ready', 'ready', 'ready', 'ready'])
    cy.get(ROOT).each(($root) => {
      expect($root.attr('data-source')).to.equal('folded')
      expect($root.find('.mermaid-diagram__source pre').is(':visible')).to.equal(false)
      expect($root.find('svg.pele')).to.have.length(1)
    })
  })

  it('keeps every diagram a diagram when a multi-diagram range is pasted', () => {
    setDoc(doc(para('Start'), code(LEFT), para('Middle'), code(UNICODE), code(JS, 'js'), code('')))
    expectAllStates(['ready', 'ready', 'empty'])

    cy.getEditor().then((editor) => {
      const { state, view } = editor
      const slice = state.doc.slice(0, state.doc.content.size)
      const { dom } = view.serializeForClipboard(slice)
      editor.commands.setContent('<p>Target</p>')
      editor.commands.setTextSelection(editor.state.doc.content.size - 1)
      expect(view.pasteHTML(dom.innerHTML)).to.equal(true)
      expect(mermaidSources(editor)).to.deep.equal([LEFT, UNICODE, ''])
    })
    expectAllStates(['ready', 'ready', 'empty'])
    cy.get('#editor pre').not(`${ROOT} pre`).should('have.text', JS)
  })
})

export {}
