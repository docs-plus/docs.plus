/// <reference types="cypress" />

// Failure modes: a complex source of one type fails to load its lazy chunk, draws as the
// wrong type, or draws only part of its content (participants, states, tasks, series or
// slices go missing). Flowcharts live in complex-flowchart.cy.ts.

const VIEW = '.mermaid-diagram > [data-state]'

// Escaped, so `setContent` keeps every `<<choice>>` and `&` as source text, not as HTML.
function block(src: string): string {
  const text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return '<pre><code class="language-mermaid">' + text + '</code></pre>'
}

function expectState(state: string): void {
  cy.get(VIEW).should('have.attr', 'data-state', state)
}

// Space between text nodes, because a label and its tspan value carry no space of their own.
// One line per <text>, so a label can never match across two separate labels.
function svgText(svg: Element): string {
  return Array.from(svg.querySelectorAll('text'), (text) => {
    const parts: string[] = []
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) parts.push(walker.currentNode.nodeValue ?? '')
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }).join('\n')
}

interface Case {
  type: string
  topic: string
  source: string
  labels: string[]
  // Selector inside the SVG mapped to the count the source asks for.
  parts?: Record<string, number>
}

const CASES: Case[] = [
  {
    type: 'sequence',
    topic: 'a pad opens, syncs and saves',
    source: `sequenceDiagram
  autonumber
  box Browser
    actor Writer
    participant Editor as Tiptap editor
  end
  box Server
    participant Hocus as Hocuspocus
    participant Redis
  end
  participant DB as Postgres
  Writer->>+Editor: Open pad
  Editor->>+Hocus: Connect with token
  critical Check access
    Hocus->>DB: Read document row
  option Token expired
    Hocus--xEditor: Close 4401
  end
  alt New document
    Hocus->>DB: Insert draft
  else Saved document
    DB-->>Hocus: Last snapshot
  end
  Hocus-->>-Editor: Initial sync
  par Awareness
    Editor-)Hocus: Cursor position
  and Fan out
    Hocus-)Redis: Publish update
  end
  loop Every keystroke
    Writer->>Editor: Type
    Editor-)Hocus: Yjs update
  end
  opt Idle for 2 seconds
    rect rgb(230, 240, 255)
      Hocus->>DB: Store snapshot
      DB--)Hocus: Stored
    end
  end
  break Network lost
    Editor-xHocus: Disconnect
  end
  Note over Editor,Hocus: Offline edits wait in IndexedDB
  Note right of DB: Full snapshots stay
  Editor-->>-Writer: Saved badge
  Writer-->Editor: Read
  Editor->Writer: Idle`,
    labels: [
      'Writer',
      'Tiptap editor',
      'Hocuspocus',
      'Redis',
      'Postgres',
      'Browser',
      'Server',
      'Open pad',
      'Connect with token',
      'Check access',
      'Token expired',
      'Close 4401',
      'Insert draft',
      'Last snapshot',
      'Initial sync',
      'Cursor position',
      'Publish update',
      'Every keystroke',
      'Idle for 2 seconds',
      'Store snapshot',
      'Network lost',
      'Disconnect',
      'Offline edits wait in IndexedDB',
      'Full snapshots stay',
      'Saved badge'
    ],
    parts: {
      'g.pele-sequence-number': 17,
      'rect.pele-activation': 2,
      'g.pele-box': 2,
      'g.pele-note': 2,
      'rect.pele-rect': 1,
      'g.pele-frame-critical': 1,
      'g.pele-frame-alt': 1,
      'g.pele-frame-par': 1,
      'g.pele-frame-loop': 1,
      'g.pele-frame-opt': 1,
      'g.pele-frame-break': 1
    }
  },
  {
    type: 'state',
    topic: 'a document from draft to deleted',
    // Choice and fork are declared before their first transition. Pele draws a plain
    // state when the declaration comes after the name is first used.
    source: `stateDiagram-v2
  direction LR
  state Check <<choice>>
  state Split <<fork>>
  state Merge <<join>>
  [*] --> Draft: create
  state Draft {
    [*] --> Empty
    Empty --> Edited: first edit
    Edited --> Edited: autosave
  }
  Draft --> Check: rename
  Check --> Published: has title
  Check --> Draft: no title
  state Published {
    [*] --> Shared
    state Shared {
      [*] --> ReadOnly
      ReadOnly --> Writable: grant edit
      Writable --> ReadOnly: revoke
    }
    --
    [*] --> Quiet
    Quiet --> Chatting: first message
    Chatting --> Quiet: last reader leaves
  }
  Published --> Split: export
  Split --> Markdown
  Split --> PDF
  Markdown --> Merge
  PDF --> Merge
  Merge --> Published
  Published --> Trashed: delete
  Trashed --> Published: restore
  Trashed --> [*]: purge after 30 days
  note right of Trashed
    Owner can restore
    for 30 days
  end note
  note left of Draft: Visitors see a read-only view`,
    labels: [
      'Draft',
      'Empty',
      'Edited',
      'first edit',
      'autosave',
      'rename',
      'has title',
      'no title',
      'Published',
      'Shared',
      'ReadOnly',
      'Writable',
      'grant edit',
      'Quiet',
      'Chatting',
      'last reader leaves',
      'export',
      'Markdown',
      'PDF',
      'Trashed',
      'restore',
      'purge after 30 days',
      'Owner can restore for 30 days',
      'Visitors see a read-only view'
    ],
    parts: {
      'g.pele-state-composite': 3,
      'path.pele-divider': 1,
      'g.pele-state-choice': 1,
      'g.pele-state-fork': 1,
      'g.pele-state-join': 1,
      'g.pele-state-end': 1,
      'g.pele-note': 2
    }
  },
  {
    type: 'class',
    topic: 'the editor document model',
    source: `classDiagram
  direction TB
  namespace Collab {
    class Provider {
      <<interface>>
      +connect(token: string) Promise~void~
      +disconnect() void
    }
    class HocuspocusProvider {
      -socket: WebSocket
      #status: Status
      +connect(token: string) Promise~void~
      +disconnect() void
    }
  }
  class Document~T~ {
    <<abstract>>
    +String slug
    +String title
    -List~Heading~ headings
    +toMarkdown()$ String
    +rename(title: String) bool
    ~touch() void
  }
  class PadDocument {
    +Boolean isPrivate
    +List~Channel~ channels
  }
  class Heading {
    +Number level
    +String text
  }
  class Channel {
    +String id
    +send(body: String) Message
  }
  class Message {
    +String body
    +Date createdAt
  }
  class Status {
    <<enumeration>>
    CONNECTING
    CONNECTED
    OFFLINE
  }
  Provider <|.. HocuspocusProvider : implements
  Document~T~ <|-- PadDocument : extends
  PadDocument *-- "1..*" Heading : contains
  PadDocument "1" o-- "0..*" Channel : owns
  Channel --> "*" Message : holds
  HocuspocusProvider ..> PadDocument : syncs
  HocuspocusProvider -- Status
  Message .. Heading : quotes`,
    labels: [
      'Collab',
      '«interface»',
      'Provider',
      'HocuspocusProvider',
      '-socket: WebSocket',
      '#status: Status',
      '+connect(token: string) : Promise<void>',
      '«abstract»',
      'Document<T>',
      '-List<Heading> headings',
      '+toMarkdown() : String',
      '+rename(title: String) : bool',
      '~touch() : void',
      'PadDocument',
      '+List<Channel> channels',
      'Heading',
      'Channel',
      '+send(body: String) : Message',
      'Message',
      '«enumeration»',
      'CONNECTING',
      'OFFLINE',
      'implements',
      'extends',
      'contains',
      'owns',
      'holds',
      'syncs',
      'quotes',
      '1..*',
      '0..*'
    ],
    parts: {
      'g.pele-namespace': 1,
      'g.pele-class': 8,
      'g.pele-relation': 8,
      'text.pele-cardinality': 4,
      'text.pele-static': 1
    }
  },
  {
    type: 'er',
    topic: 'users, documents, chat and notifications',
    source: `erDiagram
  USERS ||--o{ DOCUMENTS : owns
  USERS }|..|{ CHANNELS : joins
  DOCUMENTS ||--|{ CHANNELS : "has heading channels"
  CHANNELS ||--o{ MESSAGES : holds
  USERS |o--o{ MESSAGES : writes
  USERS ||--o{ BOOKMARKS : saves
  MESSAGES ||--o| BOOKMARKS : "is saved as"
  USERS ||--|| PROFILES : has
  USERS }o--o{ NOTIFICATIONS : receives
  MESSAGES |o--|| NOTIFICATIONS : triggers
  USERS {
    uuid id PK
    text email UK "sign-in address"
    text username UK
    timestamptz created_at
  }
  PROFILES {
    uuid user_id PK, FK
    text avatar_url
    jsonb settings "theme and digest"
  }
  DOCUMENTS {
    uuid id PK
    text slug UK
    uuid owner_id FK
    boolean is_private "owner only"
  }
  CHANNELS {
    text id PK "heading id"
    uuid document_id FK
    text name
  }
  MESSAGES {
    uuid id PK
    text channel_id FK
    uuid user_id FK
    text content
    timestamptz deleted_at "soft delete"
  }
  BOOKMARKS {
    uuid id PK
    uuid message_id FK
    boolean archived
  }
  NOTIFICATIONS {
    uuid id PK
    uuid receiver_id FK
    text type "mention or reply"
    timestamptz readed_at
  }`,
    labels: [
      'USERS',
      'PROFILES',
      'DOCUMENTS',
      'CHANNELS',
      'MESSAGES',
      'BOOKMARKS',
      'NOTIFICATIONS',
      'owns',
      'joins',
      'has heading channels',
      'holds',
      'writes',
      'saves',
      'is saved as',
      'receives',
      'triggers',
      'sign-in address',
      'avatar_url',
      'theme and digest',
      'owner_id',
      'owner only',
      'heading id',
      'soft delete',
      'archived',
      'readed_at',
      'mention or reply',
      'PK, FK'
    ],
    parts: {
      'g.pele-entity': 7,
      'g.pele-edge': 10,
      'g.pele-er-non-identifying': 1,
      'text.pele-er-name': 26,
      'text.pele-er-keys': 16,
      'text.pele-er-comment': 6
    }
  },
  {
    type: 'gantt',
    topic: 'the v2.2.0 release week',
    source: `gantt
  title docs.plus v2.2.0 release week
  dateFormat YYYY-MM-DD
  axisFormat %a %d
  excludes weekends
  section Mermaid
    Pele spike             :done, spike, 2026-10-12, 1d
    Node view and states   :done, view, after spike, 2d
    Cypress specs          :active, specs, after view, 2d
    Phone run              :crit, phone, after specs, 1d
  section Release
    Changelog              :done, log, 2026-10-14, 1d
    Docs sync              :active, docs, after log, 2d
    Freeze                 :milestone, crit, freeze, 2026-10-20, 0d
    Publish to npm         :crit, npm, after freeze, 1d
  section Demo
    Demo page              :demo, after docs, 2d
    Release banner         :banner, after npm, 1d`,
    labels: [
      'docs.plus v2.2.0 release week',
      'Mermaid',
      'Release',
      'Demo',
      'Pele spike',
      'Node view and states',
      'Cypress specs',
      'Phone run',
      'Changelog',
      'Docs sync',
      'Freeze',
      'Publish to npm',
      'Demo page',
      'Release banner'
    ],
    parts: {
      'g.pele-task': 10,
      'g.pele-done': 3,
      'g.pele-active': 2,
      'g.pele-crit': 3,
      'g.pele-milestone': 1,
      'g.pele-excluded rect': 1
    }
  },
  {
    type: 'xychart',
    topic: 'pads opened per day',
    source: `xychart-beta
  title "Pads opened per day"
  x-axis [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  y-axis "Pads (thousands)" 0 --> 12
  bar [5.2, 6.8, 7.1, 9.4, 8.3, 3.1, 2.6]
  line [4.0, 5.5, 6.2, 7.9, 7.4, 2.8, 2.2]`,
    labels: [
      'Pads opened per day',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
      'Pads (thousands)',
      '12'
    ],
    parts: { 'g.pele-bars rect': 7, 'g.pele-line path': 1, 'g.pele-line circle': 7 }
  },
  {
    type: 'pie',
    topic: 'chat messages by channel kind',
    source: `pie showData
  title Chat messages by channel kind
  "Heading channels" : 412
  "Document channel" : 238
  "Direct replies" : 97
  "Threads" : 61
  "Voice notes" : 23`,
    labels: [
      'Chat messages by channel kind',
      'Heading channels [412]',
      'Document channel [238]',
      'Direct replies [97]',
      'Threads [61]',
      'Voice notes [23]'
    ],
    parts: { 'path.pele-slice': 5, 'g.pele-legend-item': 5 }
  },
  {
    type: 'quadrantChart',
    topic: 'the extension backlog',
    source: `quadrantChart
  title Extension backlog
  x-axis Low effort --> High effort
  y-axis Low value --> High value
  quadrant-1 Plan it
  quadrant-2 Do it now
  quadrant-3 Maybe later
  quadrant-4 Skip it
  Mermaid zoom: [0.3, 0.8]
  Inline link icons: [0.45, 0.7]
  TOC section move: [0.8, 0.85]
  Passkeys: [0.7, 0.15]
  Emoji picker: [0.2, 0.25]`,
    labels: [
      'Extension backlog',
      'Low effort',
      'High effort',
      'Low value',
      'High value',
      'Plan it',
      'Do it now',
      'Maybe later',
      'Skip it',
      'Mermaid zoom',
      'Inline link icons',
      'TOC section move',
      'Passkeys',
      'Emoji picker'
    ],
    parts: { 'g.pele-quadrant': 4, 'circle.pele-point': 5 }
  },
  {
    type: 'mindmap',
    topic: 'the docs.plus product',
    source: `mindmap
  root((docs.plus))
    Editor
      [Headings]
        Fold
        Section move
      (Extensions)
        Hyperlink
        Mermaid
        Indent
    Chat
      ))Heading channels((
        Threads
        Voice notes
      {{Notifications}}
    Backend
      )Hocuspocus(
        Snapshots
      Supabase
        RLS
        Storage`,
    labels: [
      'docs.plus',
      'Editor',
      'Headings',
      'Fold',
      'Section move',
      'Extensions',
      'Hyperlink',
      'Mermaid',
      'Indent',
      'Chat',
      'Heading channels',
      'Threads',
      'Voice notes',
      'Notifications',
      'Backend',
      'Hocuspocus',
      'Snapshots',
      'Supabase',
      'RLS',
      'Storage'
    ],
    parts: {
      'g.pele-node': 20,
      'g.pele-root': 1,
      'g.pele-shape-rect': 1,
      'g.pele-shape-rounded': 1,
      'g.pele-shape-bang': 1,
      'g.pele-shape-hex': 1,
      'g.pele-shape-cloud': 1
    }
  },
  {
    type: 'timeline',
    topic: 'docs.plus releases',
    source: `timeline
  title docs.plus releases
  section 2026 summer
    July : v2.0.0 : Extensions v2
    August : Chat voice notes
  section 2026 autumn
    September : Report route : Passkeys removed
    October : v2.1.0 : v2.2.0 with Mermaid`,
    labels: [
      'docs.plus releases',
      '2026 summer',
      '2026 autumn',
      'July',
      'v2.0.0',
      'Extensions v2',
      'August',
      'Chat voice notes',
      'September',
      'Report route',
      'Passkeys removed',
      'October',
      'v2.1.0',
      'v2.2.0 with Mermaid'
    ],
    parts: { 'g.pele-section': 2, 'g.pele-period': 4, 'g.pele-event': 7 }
  },
  {
    type: 'sankey',
    topic: 'where pad visits go',
    source: `sankey-beta
Landing,Sign in,420
Landing,Visitor pad,880
Sign in,Own pad,300
Sign in,Shared pad,120
Visitor pad,Read only,640
Visitor pad,Sign in prompt,240
Own pad,Chat,180
Shared pad,Chat,70`,
    labels: [
      'Landing 1300',
      'Sign in 420',
      'Visitor pad 880',
      'Own pad 300',
      'Shared pad 120',
      'Read only 640',
      'Sign in prompt 240',
      'Chat 250'
    ],
    parts: { 'path.pele-sankey-link': 8, 'rect.pele-sankey-node': 8 }
  },
  {
    type: 'gitGraph',
    topic: 'the extension release branches',
    source: `gitGraph
  commit id: "init"
  commit id: "toolbar" tag: "v2.0.0"
  branch mermaid
  checkout mermaid
  commit id: "pele spike"
  commit id: "node view" type: HIGHLIGHT
  branch hotfix
  checkout hotfix
  commit id: "fix paste" type: REVERSE
  checkout main
  commit id: "docs sync"
  cherry-pick id: "fix paste"
  checkout mermaid
  merge hotfix
  commit id: "fold"
  checkout main
  merge mermaid tag: "v2.2.0"
  commit id: "changelog" type: HIGHLIGHT`,
    labels: [
      'main',
      'mermaid',
      'hotfix',
      'init',
      'toolbar',
      'v2.0.0',
      'pele spike',
      'node view',
      'fix paste',
      'docs sync',
      'cherry-pick:fix paste',
      'fold',
      'v2.2.0',
      'changelog'
    ],
    parts: {
      'g.pele-branch': 3,
      'g.pele-commit': 11,
      'g.pele-commit-highlight': 2,
      'g.pele-commit-reverse': 1,
      'g.pele-commit-cherry-pick': 1,
      'g.pele-commit-merge': 2,
      'path.pele-edge-merge': 2,
      'path.pele-edge-cherry-pick': 1
    }
  },
  {
    type: 'journey',
    topic: 'a first visit to a shared pad',
    source: `journey
  title First visit to a shared pad
  section Arrive
    Open the link: 5: Visitor
    Read the outline: 4: Visitor
  section Join in
    Sign in with email: 2: Visitor, Owner
    Get edit access: 3: Owner, Visitor
  section Collaborate
    Chat on a heading: 5: Visitor, Owner, Bot
    Restore a version: 3: Owner`,
    labels: [
      'First visit to a shared pad',
      'Arrive',
      'Join in',
      'Collaborate',
      'Open the link',
      'Read the outline',
      'Sign in with email',
      'Get edit access',
      'Chat on a heading',
      'Restore a version',
      'Visitor',
      'Owner',
      'Bot'
    ],
    // A narrow column switches Pele to a step layout, so count only parts both layouts draw.
    parts: {
      'g.pele-face': 6,
      'g.pele-face-happy': 3,
      'g.pele-face-sad': 1,
      'circle.pele-actor': 10
    }
  },
  {
    type: 'requirement',
    topic: 'the Mermaid extension limits',
    source: `requirementDiagram
  requirement draw_diagram {
    id: R1
    text: "Draw every fenced mermaid block"
    risk: medium
    verifymethod: test
  }
  performanceRequirement size_limit {
    id: R1.1
    text: "Refuse sources over the limit"
    risk: low
    verifymethod: inspection
  }
  interfaceRequirement keep_source {
    id: R2
    text: "Keep the source editable"
    risk: high
    verifymethod: demonstration
  }
  designConstraint lazy_chunks {
    id: R3
    text: "Load one chunk per type"
    risk: low
    verifymethod: analysis
  }
  element node_view {
    type: "Tiptap node view"
    docref: src/nodeView.ts
  }
  element cypress_suite {
    type: "Cypress spec"
  }
  draw_diagram - contains -> size_limit
  draw_diagram - derives -> lazy_chunks
  node_view - satisfies -> draw_diagram
  node_view - satisfies -> keep_source
  cypress_suite - verifies -> size_limit
  keep_source - refines -> draw_diagram
  lazy_chunks - traces -> node_view
  size_limit - copies -> lazy_chunks`,
    labels: [
      'draw_diagram',
      'size_limit',
      'keep_source',
      'lazy_chunks',
      'node_view',
      'cypress_suite',
      '«Performance Requirement»',
      '«Design Constraint»',
      'Draw every fenced mermaid block',
      'Refuse sources over the limit',
      'Keep the source editable',
      'Load one chunk per type',
      'Tiptap node view',
      'src/nodeView.ts',
      'Demonstration',
      '«contains»',
      '«derives»',
      '«satisfies»',
      '«verifies»',
      '«refines»',
      '«traces»',
      '«copies»'
    ],
    parts: { 'g.pele-requirement': 4, 'g.pele-element': 2, 'g.pele-edge': 8 }
  },
  {
    type: 'kanban',
    topic: 'the v2.3.0 board',
    source: `kanban
  todo[Todo]
    t1[Inline link icons]@{ ticket: 512, assigned: 'hossein', priority: 'High' }
    t2[TOC section move]@{ ticket: 499, priority: 'Very High' }
  doing[In progress]
    t3[Mermaid phone run]@{ ticket: 530, assigned: 'edward', priority: 'Low' }
  review[Review]
    t4[Stuck online users]@{ ticket: 496 }
    t5[Re-keyed headings]
  done[Done]
    t6[Release banner]@{ priority: 'Very Low' }`,
    labels: [
      'Todo',
      'In progress',
      'Review',
      'Done',
      'Inline link icons',
      'TOC section move',
      'Mermaid phone run',
      'Stuck online users',
      'Re-keyed headings',
      'Release banner',
      '512',
      '530',
      'hossein',
      'edward'
    ],
    parts: {
      'g.pele-column': 4,
      'g.pele-card': 6,
      'g.pele-priority-very-high': 1,
      'g.pele-priority-very-low': 1
    }
  },
  {
    type: 'architecture',
    topic: 'the docs.plus production stack',
    source: `architecture-beta
  group edge(cloud)[Edge]
  group app(server)[App servers]
  group data(database)[Data]
  service traefik(internet)[Traefik] in edge
  service webapp(server)[Next webapp] in app
  service hocus(server)[Hocuspocus] in app
  service rest(server)[REST API] in app
  service pg(database)[Postgres] in data
  service redis(database)[Redis] in data
  service storage(disk)[Object storage] in data
  junction fan in app
  traefik:R --> L:webapp
  webapp:B --> T:fan
  fan:L -- R:hocus
  fan:R -- L:rest
  hocus:B --> T:pg
  hocus:R --> L:redis
  rest:B --> T:storage
  rest{group}:R --> L:pg{group}`,
    labels: [
      'Edge',
      'App servers',
      'Data',
      'Traefik',
      'Next webapp',
      'Hocuspocus',
      'REST API',
      'Postgres',
      'Redis',
      'Object storage'
    ],
    parts: { 'g.pele-cluster': 3, 'g.pele-service': 7, 'g.pele-junction': 1, 'g.pele-edge': 8 }
  },
  {
    type: 'c4',
    topic: 'the docs.plus system context',
    source: `C4Context
  title System context for docs.plus
  Person(writer, "Writer", "Edits pads and chats on headings")
  Person_Ext(visitor, "Visitor", "Reads a shared pad")
  Enterprise_Boundary(b0, "docs.plus") {
    System(pad, "Pad app", "Next webapp and Hocuspocus")
    SystemDb(db, "Supabase", "Postgres, auth and storage")
    System_Boundary(b1, "Mail") {
      System_Ext(resend, "Resend", "Sign-in and digest mail")
    }
  }
  System_Ext(google, "Google", "OAuth sign-in")
  Rel(writer, pad, "Edits", "WebSocket")
  Rel(visitor, pad, "Reads", "HTTPS")
  BiRel(pad, db, "Stores snapshots")
  Rel(pad, resend, "Sends mail", "SMTP")
  Rel(writer, google, "Signs in with")`,
    labels: [
      'System context for docs.plus',
      'Writer',
      'Edits pads and chats on headings',
      'Visitor',
      'Reads a shared pad',
      'Pad app',
      'Supabase',
      'Postgres, auth and storage',
      'Resend',
      'Sign-in and digest mail',
      'Google',
      'OAuth sign-in',
      'Mail',
      'Edits',
      '[WebSocket]',
      'Reads',
      '[HTTPS]',
      'Stores snapshots',
      'Sends mail',
      '[SMTP]',
      'Signs in with'
    ],
    parts: {
      'g.pele-c4-boundary': 2,
      'g.pele-node': 6,
      'g.pele-c4-system_db': 1,
      'g.pele-c4-external_person': 1,
      'g.pele-edge': 5
    }
  },
  {
    type: 'treemap',
    topic: 'bundle size by package',
    source: `treemap-beta
"webapp"
  "editor"
    "tiptap": 420
    "yjs": 180
    "extensions": 160
  "chat"
    "composer": 140
    "virtuoso": 90
  "shell"
    "next": 300
    "daisy": 160
"admin"
  "charts": 210
  "tables": 170`,
    labels: [
      'webapp',
      'editor',
      'tiptap',
      'yjs',
      'extensions',
      'chat',
      'composer',
      'virtuoso',
      'shell',
      'next',
      'daisy',
      'admin',
      'charts',
      'tables',
      '1,450'
    ],
    parts: { 'g.pele-section': 5, 'g.pele-leaf': 9 }
  },
  {
    type: 'radar',
    topic: 'extension quality scores',
    source: `radar-beta
  title Extension quality
  axis docs["Docs"], tests["Tests"], a11y["Access"], perf["Speed"], api["API"]
  curve mermaid["Mermaid"]{4, 5, 3, 4, 4}
  curve hyperlink["Hyperlink"]{5, 4, 4, 5, 3}
  curve indent["Indent"]{3, 3, 5, 5, 4}
  max 5
  min 0`,
    labels: [
      'Extension quality',
      'Docs',
      'Tests',
      'Access',
      'Speed',
      'API',
      'Mermaid',
      'Hyperlink',
      'Indent'
    ],
    parts: { 'path.pele-curve': 3, 'g.pele-axis-label': 5, 'g.pele-legend-item': 3 }
  },
  {
    type: 'block',
    topic: 'the editor save path',
    source: `block-beta
  columns 3
  editor["Tiptap editor"] space:1 provider["Provider"]
  space:3
  block:server:3
    columns 2
    hocus["Hocuspocus"] queue[("Persist queue")]
  end
  db[("Postgres")] blockArrowId<["Snapshot"]>(left) redis{{"Redis"}}
  editor --> provider
  provider --> hocus
  hocus --> queue
  queue -- "every 2 s" --> db`,
    labels: [
      'Tiptap editor',
      'Provider',
      'Hocuspocus',
      'Persist queue',
      'Postgres',
      'Snapshot',
      'Redis',
      'every 2 s'
    ],
    parts: {
      'g.pele-cluster': 1,
      'g.pele-node': 7,
      'g.pele-shape-cyl': 2,
      'g.pele-shape-block-arrow': 1,
      'g.pele-shape-hex': 1,
      'g.pele-edge': 4
    }
  }
]

describe('mermaid — complex charts', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  for (const c of CASES) {
    it(`draws a complex ${c.type} in full: ${c.topic}`, () => {
      cy.setEditorContent(block(c.source))
      cy.get('.mermaid-diagram__source pre').should('have.text', c.source)
      expectState('ready')
      // Read from the SVG only: the source `<pre>` holds every label too.
      cy.get(`${VIEW} svg.pele.pele-${c.type}`)
        .should('have.attr', 'aria-label', `${c.type} diagram`)
        .should(($svg) => {
          const text = svgText($svg[0])
          for (const label of c.labels) expect(text, label).to.include(label)
        })
      for (const [selector, count] of Object.entries(c.parts ?? {})) {
        cy.get(`${VIEW} svg.pele ${selector}`).should('have.length', count)
      }
    })
  }
})

export {}
