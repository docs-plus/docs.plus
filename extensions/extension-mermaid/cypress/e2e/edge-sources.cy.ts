/// <reference types="cypress" />

// Failure modes: an empty-looking source shows the wrong state or message; frontmatter, a
// directive, CRLF, a BOM or tabs break a diagram or shift its error line; a keyword variant
// draws as the wrong type; acc metadata is lost; a late `<<choice>>` drifts from Mermaid;
// a hostile style, click, link or image reaches the page; a very long line widens the page.

const VIEW = '.mermaid-diagram > [data-state]'
const FRAME = '.mermaid-diagram'

// Escaped, so `setContent` keeps every `<<choice>>` and `&` as source text, not as HTML.
function block(src: string): string {
  const text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return '<pre><code class="language-mermaid">' + text + '</code></pre>'
}

// The HTML parser turns `\r\n` into `\n`, so byte-exact sources go in as JSON.
function setSources(...sources: string[]): void {
  cy.getEditor().then((editor) => {
    editor.commands.setContent({
      type: 'doc',
      content: sources.map((text) => ({
        type: 'codeBlock',
        attrs: { language: 'mermaid' },
        content: [{ type: 'text', text }]
      }))
    })
  })
}

// Proves the bytes reached the document, before any render check can pass by accident.
function expectStoredSources(sources: string[]): void {
  cy.getEditor().should((editor) => {
    const stored: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'codeBlock' && node.attrs.language === 'mermaid') {
        stored.push(node.textContent)
      }
    })
    expect(stored).to.deep.equal(sources)
  })
}

// A block draws only once it nears the viewport, so later blocks scroll in first.
function expectState(state: string, index = 0): void {
  cy.get(VIEW).eq(index).scrollIntoView().should('have.attr', 'data-state', state)
}

function svg(index = 0): Cypress.Chainable<JQuery<SVGSVGElement>> {
  return cy.get(FRAME).eq(index).find('svg.pele')
}

// Labels come from the SVG only: the source `<pre>` holds every label too.
function expectLabels(index: number, labels: string[]): void {
  svg(index).should(($svg) => {
    const texts = [...$svg[0].querySelectorAll('text')].map((t) =>
      (t.textContent ?? '').replace(/\s+/g, ' ').trim()
    )
    expect(texts).to.include.members(labels)
  })
}

function expectError(message: string, detail: RegExp, index = 0): void {
  expectState('error', index)
  cy.get(FRAME).eq(index).find('.mermaid-diagram__message').should('have.text', message)
  cy.get(FRAME).eq(index).find('.mermaid-diagram__detail').invoke('text').should('match', detail)
}

function edgePaths(index: number): Cypress.Chainable<string[]> {
  return svg(index)
    .find('g.pele-edge path:not(.pele-marker)')
    .then(($paths) => [...$paths].map((p) => p.getAttribute('d') ?? ''))
}

const BRANCH = `flowchart TD
  A[Start] --> B[Left]
  A --> C[Middle]
  A --> D[Right]
  B --> E[End]
  D --> E`
const BRANCH_LABELS = ['Start', 'Left', 'Middle', 'Right', 'End']

const BROKEN_BODY = `flowchart LR
  A[Write] --> B[Ship]
  B --> C[Done
  C --> D[Archive]`

describe('mermaid — edge sources', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visitPlayground()
  })

  describe('empty-like sources', () => {
    it('keeps a whitespace-only source empty, with no error and no diagram', () => {
      const src = '   \n\t\n  '
      setSources(src)
      expectStoredSources([src])
      expectState('empty')
      cy.get(`${FRAME} svg.pele`).should('not.exist')
      cy.get('.mermaid-diagram__error').should('not.be.visible')
      cy.get('.mermaid-diagram__message').should('have.text', '')
    })

    // The writer only sees "not supported", though the real gap is a missing header line.
    it('reports a comments-only source as an unsupported type', () => {
      cy.setEditorContent(block('%% one\n%% two'))
      expectError(
        'This diagram type is not supported.',
        /^No diagram type detected for the given text\.$/
      )
      cy.get(`${FRAME} svg.pele`).should('not.exist')
    })

    it('draws a lone flowchart keyword as a ready diagram with no nodes', () => {
      cy.setEditorContent(block('flowchart LR'))
      expectState('ready')
      svg().should('have.class', 'pele-flowchart')
      svg().find('g.pele-node').should('have.length', 0)
      cy.get('.mermaid-diagram__error').should('not.be.visible')
    })
  })

  describe('frontmatter', () => {
    it('draws the frontmatter title and applies its flowchart curve', () => {
      const src = `---
title: Release plan
config:
  flowchart:
    curve: linear
---
${BRANCH}`
      cy.setEditorContent(block(src) + block(BRANCH))
      expectState('ready', 0)
      expectState('ready', 1)
      svg(0).find('text.pele-title').should('have.text', 'Release plan')
      svg(1).find('text.pele-title').should('not.exist')
      expectLabels(0, BRANCH_LABELS)
      edgePaths(1).should((paths) => expect(paths.join(' ')).to.match(/[CQ]/))
      edgePaths(0).should((paths) => {
        expect(paths).to.have.length(5)
        expect(paths.join(' ')).not.to.match(/[CQ]/)
      })
    })

    // The maintainer accepted that error lines can be off after leading metadata; this pins today's numbers.
    it('points a mistake after frontmatter, a directive or a comment at its source line', () => {
      const sources = [
        `---\ntitle: Release plan\n---\n${BROKEN_BODY}`,
        `%%{init: {"theme": "dark"}}%%\n${BROKEN_BODY}`,
        `%% a note first\n${BROKEN_BODY}`,
        BROKEN_BODY
      ]
      const lines = [7, 5, 5, 4]
      cy.setEditorContent(sources.map(block).join(''))
      lines.forEach((line, i) => {
        expectError(
          `Line ${line}, column 10: this line has a mistake.`,
          new RegExp(`^Parse error on line ${line}:`),
          i
        )
      })
    })
  })

  describe('directives', () => {
    it('ignores a theme directive but applies a curve directive', () => {
      cy.setEditorContent(
        block(`%%{init: {"theme": "dark"}}%%\n${BRANCH}`) +
          block(`%%{init: {"flowchart": {"curve": "linear"}}}%%\n${BRANCH}`) +
          block(BRANCH)
      )
      for (const i of [0, 1, 2]) {
        expectState('ready', i)
        expectLabels(i, BRANCH_LABELS)
      }
      // Pele themes through --pele-* only, so a dark directive must change no colour.
      const colours = (i: number): Cypress.Chainable<string[]> =>
        svg(i)
          .find('g.pele-node rect')
          .first()
          .then(($rect) => {
            const style = getComputedStyle($rect[0])
            return [style.fill, style.stroke]
          })
      colours(2).then((plain) => {
        colours(0).should('deep.equal', plain)
      })
      edgePaths(2).should((paths) => expect(paths.join(' ')).to.match(/[CQ]/))
      edgePaths(0).should((paths) => expect(paths.join(' ')).to.match(/[CQ]/))
      edgePaths(1).should((paths) => {
        expect(paths).to.have.length(5)
        expect(paths.join(' ')).not.to.match(/[CQ]/)
      })
    })
  })

  describe('line endings and whitespace', () => {
    const CASES: Record<string, string> = {
      'CRLF line endings': 'flowchart LR\r\n  A[Write] --> B[Ship]\r\n  B --> C[Done]\r\n',
      'tab indentation': 'flowchart LR\n\tA[Write] --> B[Ship]\n\tB --> C[Done]',
      'a leading BOM': '﻿flowchart LR\n  A[Write] --> B[Ship]\n  B --> C[Done]',
      'trailing spaces': 'flowchart LR   \n  A[Write] --> B[Ship]   \n  B --> C[Done]   \n',
      'no final newline': 'flowchart LR\n  A[Write] --> B[Ship]\n  B --> C[Done]'
    }
    for (const [name, src] of Object.entries(CASES)) {
      it(`draws a source with ${name} whole`, () => {
        setSources(src)
        expectStoredSources([src])
        expectState('ready')
        svg().should('have.class', 'pele-flowchart')
        svg().find('g.pele-node').should('have.length', 3)
        svg().find('g.pele-edge').should('have.length', 2)
        expectLabels(0, ['Write', 'Ship', 'Done'])
      })
    }
  })

  describe('diagram keywords', () => {
    it('draws the graph alias as a flowchart', () => {
      cy.setEditorContent(block('graph TD\n  A[Write] --> B[Ship]'))
      expectState('ready')
      svg()
        .should('have.class', 'pele-flowchart')
        .and('have.attr', 'aria-label', 'flowchart diagram')
      expectLabels(0, ['Write', 'Ship'])
    })

    it('reports a wrongly cased keyword and an unknown type as unsupported', () => {
      cy.setEditorContent(
        block('Flowchart LR\n  A[Write] --> B[Ship]') + block('notadiagram\n  A --> B')
      )
      for (const i of [0, 1]) {
        expectError(
          'This diagram type is not supported.',
          /^No diagram type detected for the given text\.$/,
          i
        )
      }
      cy.get(`${FRAME} svg.pele`).should('not.exist')
    })

    it('draws the v1 stateDiagram keyword the same as stateDiagram-v2', () => {
      const body = '\n  [*] --> Idle\n  Idle --> Busy\n  Busy --> [*]'
      cy.setEditorContent(block('stateDiagram' + body) + block('stateDiagram-v2' + body))
      for (const i of [0, 1]) {
        expectState('ready', i)
        svg(i).should('have.class', 'pele-state')
        svg(i).find('g.pele-node').should('have.length', 4)
        svg(i).find('g.pele-edge').should('have.length', 3)
        expectLabels(i, ['Idle', 'Busy'])
      }
    })

    it('draws a sequence diagram that starts after blank lines', () => {
      const src = '\n\n\nsequenceDiagram\n  Alice->>Bob: Hello'
      setSources(src)
      expectStoredSources([src])
      expectState('ready')
      svg().should('have.class', 'pele-sequence')
      expectLabels(0, ['Alice', 'Bob', 'Hello'])
    })
  })

  describe('accessibility metadata', () => {
    // The ids carry a per-mount prefix, so two diagrams never share a title id.
    it('links accTitle and a one-line accDescr to a title and desc inside the same SVG', () => {
      const src = `flowchart LR
  accTitle: Release steps
  accDescr: Write, review, then ship.
  A[Write] --> B[Ship]`
      cy.setEditorContent(block(src) + block(src))
      for (const i of [0, 1]) {
        expectState('ready', i)
        svg(i).should(($svg) => {
          const el = $svg[0]
          expect(el.hasAttribute('aria-label')).to.equal(false)
          const title = el.querySelector(`#${el.getAttribute('aria-labelledby')}`)
          const desc = el.querySelector(`#${el.getAttribute('aria-describedby')}`)
          expect(title?.tagName).to.equal('title')
          expect(title?.textContent).to.equal('Release steps')
          expect(desc?.tagName).to.equal('desc')
          expect(desc?.textContent).to.equal('Write, review, then ship.')
        })
      }
      svg(0).then(($a) => {
        svg(1).should(($b) => {
          expect($b.attr('aria-labelledby')).not.to.equal($a.attr('aria-labelledby'))
        })
      })
    })

    it('keeps a multi-line accDescr block as one desc with its line breaks', () => {
      const src = `flowchart LR
  accTitle: Release steps
  accDescr {
    Write first.
    Then ship.
  }
  A[Write] --> B[Ship]`
      cy.setEditorContent(block(src))
      expectState('ready')
      svg().find('desc').should('have.length', 1).and('have.text', 'Write first.\nThen ship.')
      expectLabels(0, ['Write', 'Ship'])
    })

    it('falls back to the aria-label when only accDescr is given', () => {
      cy.setEditorContent(
        block('flowchart LR\n  accDescr: Write, then ship.\n  A[Write] --> B[Ship]')
      )
      expectState('ready')
      svg().should(($svg) => {
        const el = $svg[0]
        expect(el.getAttribute('aria-label')).to.equal('flowchart diagram')
        expect(el.hasAttribute('aria-labelledby')).to.equal(false)
        const desc = el.querySelector(`#${el.getAttribute('aria-describedby')}`)
        expect(desc?.tagName).to.equal('desc')
        expect(desc?.textContent).to.equal('Write, then ship.')
      })
    })
  })

  // Mermaid's stateDb sets a state's type only when it has none, and a transition first
  // creates it as 'default'. Pele matches that on purpose, so a late `<<choice>>` stays plain.
  describe('state declaration order', () => {
    const BEFORE = `stateDiagram-v2
  state Check <<choice>>
  state F <<fork>>
  state J <<join>>
  [*] --> Check
  Check --> F: yes
  Check --> Done: no
  F --> A
  F --> B
  A --> J
  B --> J
  J --> Done`
    const AFTER = `stateDiagram-v2
  [*] --> Check
  Check --> F: yes
  Check --> Done: no
  F --> A
  F --> B
  A --> J
  B --> J
  J --> Done
  state Check <<choice>>
  state F <<fork>>
  state J <<join>>`
    const SPECIAL = { Check: 'pele-state-choice', F: 'pele-state-fork', J: 'pele-state-join' }

    it('draws choice, fork and join shapes when declared before first use', () => {
      cy.setEditorContent(block(BEFORE))
      expectState('ready')
      for (const [id, cls] of Object.entries(SPECIAL)) {
        svg().find(`g.pele-node[data-id="${id}"]`).should('have.class', cls)
      }
    })

    it('draws plain state boxes when they are declared after first use', () => {
      cy.setEditorContent(block(AFTER))
      expectState('ready')
      for (const [id, cls] of Object.entries(SPECIAL)) {
        svg()
          .find(`g.pele-node[data-id="${id}"]`)
          .should('have.class', 'pele-state')
          .and('not.have.class', cls)
      }
      expectLabels(0, ['Check', 'F', 'J'])
    })
  })

  describe('hostile sources', () => {
    interface Hostile {
      name: string
      source: string
      // Pele refuses several of these as syntax errors, so the scan alone would prove nothing.
      state: 'ready' | 'error'
      check?: () => void
    }

    // Attributes and <style> text only: the source pre and the error detail echo the text.
    function expectNoLiveMarkup(): void {
      cy.get(FRAME).then(($root) => {
        const root = $root[0]
        expect(
          root.querySelectorAll('script, foreignObject, iframe, a, img, image, object, embed')
        ).to.have.length(0)
        for (const el of root.querySelectorAll('*')) {
          for (const attr of el.attributes) {
            const where = `${el.tagName} ${attr.name}`
            expect(attr.name, where).not.to.match(/^on/i)
            expect(attr.value, where).not.to.match(/javascript:|expression\(/i)
            expect(attr.value, where).not.to.match(/url\(\s*['"]?(?!#)/i)
            if (/^(xlink:)?href$|^src$/i.test(attr.name)) {
              expect(attr.value, where).to.match(/^#/)
            }
          }
        }
        for (const style of root.querySelectorAll('style')) {
          expect(style.textContent).not.to.match(/javascript:|expression\(|url\(/i)
        }
      })
    }

    const CASES: Hostile[] = [
      {
        name: 'a style url(javascript:)',
        source: 'flowchart LR\n  A[Write] --> B[Ship]\n  style A fill:url(javascript:alert(1))',
        state: 'error'
      },
      {
        name: 'a classDef expression()',
        source:
          'flowchart LR\n  A[Write] --> B[Ship]\n  classDef x fill:expression(alert(1))\n  class A x',
        state: 'error'
      },
      {
        name: 'a linkStyle url(#x)',
        source: 'flowchart LR\n  A[Write] --> B[Ship]\n  linkStyle 0 stroke:url(#x)',
        state: 'error'
      },
      {
        name: 'a javascript: value in style, classDef and linkStyle',
        source: `flowchart LR
  A[Write] --> B[Ship]
  style A fill:#f9f,stroke:javascript:alert
  classDef x fill:javascript:alert,color:red
  class B x
  linkStyle 0 stroke:javascript:alert`,
        state: 'ready',
        // The safe declarations stay, so the filter drops only the hostile ones.
        check: () => {
          svg()
            .find('g.pele-node[data-id="A"] rect')
            .should('have.attr', 'style')
            .and('include', 'fill:#f9f')
          svg()
            .find('g.pele-node[data-id="B"] text')
            .should('have.attr', 'style')
            .and('include', 'fill:red')
        }
      },
      {
        name: 'a themeCSS directive',
        source:
          '%%{init: {"themeCSS": "* { background: url(javascript:alert(1)) }"}}%%\nflowchart LR\n  A[Write] --> B[Ship]',
        state: 'ready'
      },
      {
        name: 'a themeCSS in frontmatter',
        source:
          '---\nconfig:\n  themeCSS: "* { background: url(javascript:alert(1)) }"\n---\nflowchart LR\n  A[Write] --> B[Ship]',
        state: 'ready'
      },
      {
        name: 'click and link lines in a classDiagram',
        source: `classDiagram
  class Order
  class Invoice
  Order --> Invoice
  click Order href "javascript:alert(1)"
  click Invoice call alert(1)
  link Order "https://example.com"`,
        state: 'ready',
        check: () => {
          svg().find('g.pele-node').click({ multiple: true, force: true })
        }
      },
      {
        name: 'a click line with a tooltip in a stateDiagram',
        source:
          'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n  click Idle "javascript:alert(1)" "tip"',
        state: 'ready',
        check: () => {
          svg().find('g.pele-node').click({ multiple: true, force: true })
        }
      },
      {
        name: 'a click line without a tooltip in a stateDiagram',
        source:
          'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n  click Idle "javascript:alert(1)"',
        state: 'error'
      },
      {
        name: 'c4 $link and a javascript: element colour',
        source: `C4Context
  Person(u, "User", "A user", $link="javascript:alert(1)")
  System(s, "Shop", "Sells", $link="https://example.com")
  Rel(u, s, "Uses", $link="javascript:alert(1)")
  UpdateElementStyle(u, $bgColor="javascript:alert", $fontColor="red")`,
        state: 'ready',
        check: () => {
          svg().find('g.pele-node').click({ multiple: true, force: true })
        }
      },
      {
        name: 'an architecture icon given as a URL',
        source:
          'architecture-beta\n  group api(cloud)[API]\n  service web(https://example.com/x.svg)[Web] in api',
        state: 'error'
      },
      {
        name: 'architecture icons by name',
        source:
          'architecture-beta\n  group api(cloud)[API]\n  service db(database)[DB] in api\n  service web(logos:aws)[Web] in api\n  db:L -- R:web',
        state: 'ready'
      },
      {
        name: 'a flowchart image node with a remote URL',
        source:
          'flowchart LR\n  A@{ img: "https://example.com/a.png", label: "Pic", pos: "t", w: 60, h: 60 } --> B[Ship]',
        state: 'ready'
      },
      {
        name: 'a flowchart image node with a javascript: URL',
        source: 'flowchart LR\n  A@{ img: "javascript:alert(1)", label: "Pic" } --> B[Ship]',
        state: 'ready'
      },
      {
        name: 'a flowchart icon node',
        source: 'flowchart LR\n  A@{ icon: "fa:user", form: "square", label: "User" } --> B[Ship]',
        state: 'ready'
      }
    ]

    for (const c of CASES) {
      it(`keeps ${c.name} out of the live page`, () => {
        cy.intercept({ hostname: 'example.com' }, { statusCode: 204 }).as('remote')
        cy.window().then((win) => {
          cy.stub(win, 'alert').as('alert')
          cy.stub(win, 'open').as('open')
        })
        cy.setEditorContent(block(c.source))
        expectState(c.state)
        if (c.state === 'ready') svg().should('exist')
        c.check?.()
        expectNoLiveMarkup()
        cy.location('pathname').should('equal', '/')
        cy.get('@alert').should('not.have.been.called')
        cy.get('@open').should('not.have.been.called')
        // A request can be proved absent only after it had time to start.
        cy.wait(300)
        cy.get('@remote.all').should('have.length', 0)
      })
    }
  })

  describe('very long lines', () => {
    function expectPageNotWidened(): void {
      cy.document().should((doc) => {
        const root = doc.documentElement
        expect(root.scrollWidth).to.be.at.most(root.clientWidth)
      })
    }

    // No spaces, so the label cannot wrap at a word and must still fit the page.
    it('draws a 2,000 character label without widening the page', () => {
      const label = Array.from({ length: 250 }, (_, i) => `seg${String(i).padStart(4, '0')}-`).join(
        ''
      )
      expect(label).to.have.length(2000)
      cy.setEditorContent(block(`flowchart LR\n  A["${label}"] --> B[Ship]`))
      expectState('ready')
      svg()
        .find('g.pele-node[data-id="A"] text')
        .should(($text) => {
          expect(($text[0].textContent ?? '').replace(/\s+/g, '')).to.equal(label)
        })
      expectPageNotWidened()
    })

    // Assert nodes and labels only: autoDirection may turn this chain to a vertical layout.
    // The 250-edge limit binds first; this line is about 7,500 characters.
    it('draws a 250-arrow single line without widening the page', () => {
      const ids: string[] = []
      while (ids.length < 251) ids.push(`n${ids.length}[Step ${ids.length} on one line]`)
      const line = ids.join(' --> ')
      const src = `flowchart LR\n  ${line}`
      expect(line.length).to.be.greaterThan(7000)
      expect(src.length).to.be.lessThan(10000)
      cy.setEditorContent(block(src))
      cy.get(VIEW, { timeout: 15000 }).should('have.attr', 'data-state', 'ready')
      svg().find('g.pele-node').should('have.length', ids.length)
      svg()
        .find('g.pele-edge')
        .should('have.length', ids.length - 1)
      expectLabels(0, ['Step 0 on one line', `Step ${ids.length - 1} on one line`])
      expectPageNotWidened()
    })
  })
})

export {}
