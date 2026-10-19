/// <reference types="cypress" />

// Failure modes: a large real-world flowchart draws only part of its nodes, edges or labels;
// non-Latin, wrapped or markdown labels lose text; label text or click lines become live
// markup or script; the edge limit is off by one or miscounts chained edges; an edit to a
// big diagram remounts the block; a read-only block hides part of the diagram.

const VIEW = '.mermaid-diagram > [data-state]'
const SVG = `${VIEW} svg.pele.pele-flowchart`

// Escaped, so `setContent` keeps every `<` and `&` as source text instead of parsing it as HTML.
function block(src: string): string {
  const text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return '<pre><code class="language-mermaid">' + text + '</code></pre>'
}

// Changes the first mermaid block's text in place, so its node view takes the update path.
function replaceSource(text: string): void {
  cy.getEditor().then((editor) => {
    let from = -1
    let to = -1
    editor.state.doc.descendants((n, pos) => {
      if (from < 0 && n.type.name === 'codeBlock' && n.attrs.language === 'mermaid') {
        from = pos + 1
        to = pos + n.nodeSize - 1
      }
      return from < 0
    })
    editor
      .chain()
      .command(({ tr }) => {
        tr.replaceWith(from, to, editor.schema.text(text))
        return true
      })
      .setTextSelection(from + text.length)
      .run()
  })
}

function expectState(state: string): void {
  cy.get(VIEW).should('have.attr', 'data-state', state)
}

// Wrapped lines and markdown runs are separate tspans with no space between them.
// Joining them with one space gives back the label, and still catches a lost space.
function labelText(text: Element): string {
  const parts = [...text.querySelectorAll('tspan')].map((t) => (t.textContent ?? '').trim())
  const joined = parts.length ? parts.filter(Boolean).join(' ') : (text.textContent ?? '')
  return joined.replace(/\s+/g, ' ').trim()
}

// Read from the SVG by id, never from the block: the source `<pre>` holds every label too.
function expectNodeLabels(labels: Record<string, string>): void {
  for (const [id, label] of Object.entries(labels)) {
    cy.get(`${SVG} g.pele-node[data-id="${id}"] text`).should(($text) => {
      expect(labelText($text[0]), id).to.equal(label)
    })
  }
}

const NODES: Record<string, string> = {
  CDN: 'CDN cache',
  LB: 'Load balancer',
  WAF: 'Web firewall',
  GW: 'API gateway',
  Auth: 'Signed in?',
  Orders: 'Order service',
  Login: 'Login page',
  DB: 'Orders DB',
  Cache: 'Redis',
  Queue: 'Event queue',
  Mailer: 'Mailer',
  Inbox: 'Customer inbox',
  Audit: 'Audit log',
  Dead: 'Dead letters',
  Billing: 'Billing',
  Ledger: 'Ledger',
  Tax: 'Tax engine',
  Rates: 'Rate table',
  Invoice: 'Invoice PDF',
  Store: 'Object store',
  Sms: 'SMS sender',
  Phone: 'Customer phone',
  Stock: 'Stock check',
  Pick: 'Pick list',
  Supplier: 'Supplier API',
  Pack: 'Packing',
  Ship: 'Shipping label',
  Carrier: 'Carrier',
  Track: 'Tracking page',
  Survey: 'Feedback survey',
  Metrics: 'Metrics',
  Board: 'Ops dashboard',
  Pager: 'On-call pager'
}

const CLUSTERS: Record<string, string> = {
  Edge: 'Edge layer',
  Core: 'Core services',
  Api: 'API tier',
  Data: 'Data tier'
}

const EDGE_LABELS = ['yes', 'no', 'in stock', 'backorder']
const EDGES = 34

const BIG = `flowchart TB
  %% Order pipeline, drawn the way a team would draw it
  classDef hot fill:#fdd,stroke:#c00
  classDef cold fill:#ddf
  subgraph Edge[Edge layer]
    direction LR
    CDN([CDN cache]) --> LB{{Load balancer}}
    LB --> WAF[/Web firewall/]
  end
  subgraph Core[Core services]
    subgraph Api[API tier]
      direction TB
      GW[API gateway] --> Auth{Signed in?}
      Auth -- yes --> Orders[[Order service]]
      Auth -->|no| Login>Login page]
    end
    subgraph Data[Data tier]
      DB[(Orders DB)]
      Cache[(Redis)]
    end
    Orders ==> DB
    Orders -.-> Cache
  end
  WAF --> GW
  %% a chain of three arrows on one line
  Orders --> Queue((Event queue)) --> Mailer(Mailer) --> Inbox[Customer inbox]
  Queue --o Audit[Audit log]
  Queue --x Dead[Dead letters]
  Orders <--> Billing[Billing]
  Billing --- Ledger[(Ledger)]
  Billing --> Tax[Tax engine]
  Tax --> Rates[/Rate table/]
  Billing --> Invoice[Invoice PDF]
  Invoice --> Store[(Object store)]
  Mailer --> Sms(SMS sender)
  Sms --> Phone[Customer phone]
  Orders --> Stock{Stock check}
  Stock -->|in stock| Pick[Pick list]
  Stock -- backorder --> Supplier[Supplier API]
  Pick --> Pack[Packing] --> Ship[Shipping label]
  Ship --> Carrier((Carrier))
  Supplier -.-> Pick
  Carrier --> Track[Tracking page]
  Track --> Inbox
  Track --> Survey(Feedback survey)
  Survey --> Metrics[(Metrics)]
  Metrics --> Board[[Ops dashboard]]
  Board --> Pager>On-call pager]
  class Dead,Audit cold
  Board:::hot
  linkStyle 0 stroke:#f66,stroke-width:3px`

function expectWholeBigDiagram(edges = EDGES): void {
  cy.get(`${SVG} g.pele-node`).should('have.length', Object.keys(NODES).length)
  cy.get(`${SVG} g.pele-cluster`).should('have.length', Object.keys(CLUSTERS).length)
  cy.get(`${SVG} g.pele-edge`).should('have.length', edges)
  expectNodeLabels(NODES)
  for (const [id, title] of Object.entries(CLUSTERS)) {
    cy.get(`${SVG} g.pele-cluster[data-id="${id}"] text.pele-cluster-label`).should(
      'have.text',
      title
    )
  }
  cy.get(`${SVG} g.pele-edge-label text`).then(($labels) => {
    expect([...$labels].map((el) => el.textContent)).to.have.members(EDGE_LABELS)
  })
}

// Mixes plain edge lines with one chain, so a chain counted wrong moves the total off 500.
function edgeSource(lines: number, chain: number): string {
  const out = ['flowchart LR']
  for (let i = 0; i < lines; i++) out.push(`  a${i} --> a${i + 1}`)
  const ids = Array.from({ length: chain + 1 }, (_, i) => `a${lines + i}`)
  out.push('  ' + ids.join(' --> '))
  return out.join('\n')
}

describe('mermaid — complex flowchart', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visitPlayground()
  })

  it('draws every node, subgraph, edge and label of a large real-world flowchart', () => {
    cy.setEditorContent(block(BIG))
    expectState('ready')
    cy.get('.mermaid-diagram__source pre').should('have.text', BIG)
    expectWholeBigDiagram()
    cy.get(`${SVG} g.pele-node[data-id="Board"]`).should('have.class', 'hot')
    cy.get(`${SVG} g.pele-node[data-id="Dead"]`).should('have.class', 'cold')
    cy.get(`${SVG} g.pele-node[data-id="Orders"]`).should('have.class', 'pele-shape-fr-rect')
    cy.get(`${SVG} g.pele-node[data-id="DB"]`).should('have.class', 'pele-shape-cyl')
    cy.get(`${SVG} g.pele-edge[data-id="L_CDN_LB_0"]`)
      .should('have.attr', 'style')
      .and('include', 'stroke-width:3px')
  })

  it('keeps RTL, CJK, emoji, punctuation, markdown and long labels whole', () => {
    const long =
      'This is a very long label that keeps going so the renderer must wrap it across several lines'
    const src = `flowchart LR
  Fa["سلام دنیا، خوش آمدید"] --> Zh["你好世界"]
  Zh --> Ja["こんにちは"]
  Ja --> Em["🚀 Launch 🎉"]
  Em --> Q["Save, then (re)load: 100%"]
  Q --> Md["\`**Bold** and _italic_\`"]
  Md --> Long["${long}"]`
    cy.setEditorContent(block(src))
    expectState('ready')
    expectNodeLabels({
      Fa: 'سلام دنیا، خوش آمدید',
      Zh: '你好世界',
      Ja: 'こんにちは',
      Em: '🚀 Launch 🎉',
      Q: 'Save, then (re)load: 100%',
      Md: 'Bold and italic',
      Long: long
    })
    cy.get(`${SVG} g.pele-node[data-id="Md"] tspan[font-weight]`).should('have.text', 'Bold')
    cy.get(`${SVG} g.pele-node[data-id="Md"] tspan[font-style="italic"]`).should(
      'have.text',
      'italic'
    )
  })

  it('never turns label text or click lines into live markup or script', () => {
    const src = `flowchart LR
  A["<img src=x onerror=alert(1)>"] --> B["<script>alert(1)</script>"]
  B --> C["#lt;img src=x onerror=alert(1)#gt;"]
  C --> D["<b onmouseover=alert(1)>bold</b>"]
  D --> E["<foreignObject><div>inside</div></foreignObject>"]
  click A "javascript:alert(1)"
  click B href "https://example.com"`
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alert')
      cy.stub(win, 'open').as('open')
    })
    cy.setEditorContent(block(src))
    expectState('ready')
    // Proves the source reached Pele with its tags, not parsed away as HTML on the way in.
    cy.get('.mermaid-diagram__source pre').should('have.text', src)
    // Pele strips raw tags from labels; an entity-coded tag stays plain text.
    expectNodeLabels({
      A: '',
      B: 'alert(1)',
      C: '<img src=x onerror=alert(1)>',
      D: 'bold',
      E: 'inside'
    })

    cy.get('.mermaid-diagram').within(() => {
      cy.get('img, script, foreignObject, iframe, a').should('not.exist')
    })
    cy.get('.mermaid-diagram').then(($root) => {
      for (const el of $root[0].querySelectorAll('*')) {
        for (const attr of el.attributes) {
          expect(attr.name, `${el.tagName} attribute`).not.to.match(/^on/i)
          expect(attr.value, `${el.tagName} ${attr.name}`).not.to.match(/^\s*javascript:/i)
        }
      }
    })

    // Both nodes carry Pele's `clickable` class even with links off.
    cy.get(`${SVG} g.pele-node[data-id="A"]`).click({ force: true })
    cy.get(`${SVG} g.pele-node[data-id="B"]`).click({ force: true })
    cy.location('pathname').should('equal', '/')
    cy.get('@alert').should('not.have.been.called')
    cy.get('@open').should('not.have.been.called')
  })

  it('draws exactly 500 edges and refuses 501, counting each chained arrow', () => {
    const atLimit = edgeSource(250, 250)
    const overLimit = edgeSource(250, 251)
    // Both stay under the 15000 character limit, so only the edge limit can refuse them.
    expect(atLimit.length).to.be.lessThan(15000)
    expect(overLimit.length).to.be.lessThan(15000)

    cy.setEditorContent(block(atLimit))
    cy.get(VIEW, { timeout: 15000 }).should('have.attr', 'data-state', 'ready')
    cy.get(`${SVG} g.pele-edge`).should('have.length', 500)

    cy.setEditorContent(block(overLimit))
    expectState('error')
    cy.get('.mermaid-diagram__message').should('have.text', 'This diagram is too large to draw.')
    // Pele reports the count before the refused edge, so the detail says 500, not 501.
    cy.get('.mermaid-diagram__detail')
      .invoke('text')
      .should('match', /Edge limit exceeded\..*the limit is 500\./)
  })

  it('redraws an edited big flowchart in place, without a remount', () => {
    let root: HTMLElement
    cy.setEditorContent(block(BIG))
    expectState('ready')
    cy.get('.mermaid-diagram').then(($root) => {
      root = $root[0]
    })

    const edited =
      BIG.replace('Board[[Ops dashboard]]', 'Board[[Ops console]]') +
      '\n  Pager --> Escalate[Escalation policy]'
    replaceSource(edited)
    expectState('ready')
    expectNodeLabels({ Board: 'Ops console', Escalate: 'Escalation policy' })
    cy.get(`${SVG} text`).then(($texts) => {
      expect([...$texts].map((el) => el.textContent)).not.to.include('Ops dashboard')
    })
    cy.get(`${SVG} g.pele-node`).should('have.length', Object.keys(NODES).length + 1)
    cy.get(`${SVG} g.pele-edge`).should('have.length', EDGES + 1)
    cy.then(() => expect(root.isConnected).to.equal(true))
    cy.get('.mermaid-diagram').should(($now) => expect($now[0]).to.equal(root))
  })

  it('folds the source of a large flowchart in a read-only editor but draws all of it', () => {
    cy.visitPlayground('?readonly')
    cy.setEditorContent(block(BIG))
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    cy.get('.mermaid-diagram__source pre').should('not.be.visible')
    expectState('ready')
    cy.get(SVG).should('be.visible')
    expectWholeBigDiagram()
  })
})

export {}
