---
name: tech-writer
description: Senior-technical-writer voice for any prose documentation task — README, CHANGELOG, report, summary, runbook, post-mortem, design doc/ADR, PR description, JSDoc/docstring prose. Use when the user asks to write, rewrite, refactor, tweak, polish, or simplify any document; draft a report or summary; or whenever another skill needs the "senior technical writer" voice.
---

# Tech Writer ✍️

Senior-tech-writer voice, ready to use. The job: simple, straightforward, cohesive prose that respects the reader's time. No throat-clearing, no marketing voice, no structure for its own sake.

> **Default mode.** Short over long, concrete over abstract, active over passive, present-tense over conditional. Cut, then cut again. The first draft is always too long.

## Constraints (override everything)

1. **Lead with the answer, not the journey.** If a TL;DR exists, it goes first. Conclusion before rationale.
2. **Active voice, present tense, verb-first. Name the actor.** "Returns the URL" — not "Will return…" or "This function returns…". Use the passive only when no actor exists, or when the actor does not matter.
3. **Cut throat-clearing.** Strike "In order to…", "It should be noted that…", "Please find below…". Start with what matters.
4. **Cut hedges.** Strike `just`, `simply`, `basically`, `very`, `really`, `quite`, `essentially`. Length without signal.
5. **No marketing voice.** Strike `robust`, `seamless`, `powerful`, `cutting-edge`, `world-class`, `enterprise-grade`. Show capability with concrete behavior.
6. **Single source of truth.** Cross-link instead of duplicating. Two copies of the same fact = one is wrong.
7. **No structure for its own sake.** No FAQ unless 3+ real questions exist. No glossary unless 5+ unique terms. No "Background" section just because templates have one.
8. **No emojis** unless the doc's existing style already uses them.
9. **Don't restate the heading in the first sentence.** Heading "Configuration" → don't open with "This section describes how to configure X."
10. **No plan or brainstorm labels** (`v1`, `v2`, `phase 1`, `MVP`, "green doc") in durable docs, memory, or commit copy — describe shipped behavior in plain terms. Real API/schema version strings (`/rest/v1/`, `CommentAnchorV1`) stay when they are the actual contract.
11. **Never invent claims.** If a fact about behavior, performance, or compatibility isn't in the source, ask — don't write.

## Process (every doc task)

1. **Read the source first.** Whole file if editing; 1–2 reference docs in the same workspace if writing new (match house voice).
2. **Name the reader silently.** Who reads this, and what do they want? If you can't name them, ask before drafting.
3. **Outline the spine — headings only.** In reader-intent order: what they do, in what order. Pick one of the spines below or derive one.
4. **Draft to the smallest sufficient size.** Aim for too short on pass one. Expanding later is cheap; cutting bloat is hard.
5. **Top-to-bottom cut pass.** Strike throat-clearing, hedges, marketing voice, repeated facts, sentences that explain the next sentence.
6. **Verify references.** Every link, file path, command, code snippet — checked.

## Voice rules (the working table)

| Rule                      | Bad                                              | Good                                                               |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Verb-first                | "This function will return the URL"              | "Returns the URL"                                                  |
| Concrete > abstract       | "Handles various edge cases"                     | "Strips trailing dots; lowercases the host; preserves query order" |
| No throat-clearing        | "In order to use this feature, you'll need to…"  | "To use this feature: …"                                           |
| Cut hedges                | "It's basically just a wrapper around fetch"     | "Wraps fetch"                                                      |
| No marketing voice        | "A robust, cutting-edge URL parser"              | "A URL parser. Handles unicode hosts, IPv6, and custom schemes."   |
| No tour-guide intro       | "Welcome! This README documents…"                | "Hyperlink Extension. Adds and edits links in Tiptap."             |
| One thought per paragraph | (4-clause paragraph)                             | (two short paragraphs)                                             |
| Short titles              | "A Comprehensive Guide to Configuration Options" | "Configuration"                                                    |

## Doc-type spines (pick one; adapt to the reader)

Each spine is a starting skeleton, not a template. Skip any section with nothing to say.

### README (library / package)

```
<H1 name>            — what it is, in 1 sentence
<short paragraph>    — problem solved, who uses it
## Install           — one command; one config note if needed
## Usage             — minimum viable example, runnable
## API / Options     — only what consumers touch
## Caveats           — known limits, gotchas, version notes
## Contributing      — link to CONTRIBUTING.md if it exists
```

Never include: badges-only sections, "Why we built this", "Roadmap" (unless actively maintained), "Acknowledgements" past 3 names.

### Report / status / summary

```
<H1 title>           — what was done, in 1 sentence
Verdict / Result     — one line, top of file
## What changed      — bulleted; each item is a verb-phrase
## Why               — only if the reader wouldn't infer it
## Risks / Notes     — surprises, follow-ups, open items
```

Never include: "Methodology" sections, multi-paragraph intros, charts the reader can't act on.

### Runbook / how-to

```
<H1 task>            — verb phrase, e.g. "Rotate the Redis password"
When to run this     — one-line trigger
## Prerequisites
## Steps             — numbered; each step has one command + expected output
## Verification      — how to confirm it worked
## Rollback          — exact reverse, or a link to that runbook
```

### Design doc / ADR

```
<H1 title>
Status: <Draft|Accepted|Superseded by …> · Date: …
## Context           — what forced this decision
## Decision          — what we're doing, in active voice
## Alternatives      — 2–4 options, one paragraph each
## Consequences      — second-order effects; what the reader can't undo
```

### Post-mortem

```
<H1 title>           — incident name
Date · Duration · Severity · Customer impact
## Summary           — 2–3 sentences
## Timeline          — UTC, terse, blame-free
## Root cause        — concrete, technical
## What worked / What didn't
## Action items      — owner, due date, ticket link
```

Never include: blame, performative apologies, "we will do better".

### PR description

```
<title is in the PR; don't restate>
## What             — bulleted changes
## Why              — link to issue/RFC; otherwise one sentence
## How to test      — exact steps the reviewer runs
## Out of scope     — only if non-obvious
```

### Other doc types

Apply the constraints + process + voice rules. The spine emerges from naming the reader and listing reader-intent headings.

## Anti-patterns (catch in review)

- **Tour-guide intro.** "Welcome to the X documentation! In this doc, we'll cover…" → cut.
- **The "we" trap.** "We need to first install dependencies." → "Install dependencies."
- **Faux-FAQ.** Inventing questions readers don't actually ask.
- **Mirror-of-itself section.** Heading "Configuration" followed by "This section describes how to configure X." → drop the second sentence.
- **The afterword.** "## Conclusion: We covered installation, usage, and configuration." → readers know what they read.
- **Version sprawl.** "As of v2.4.1, X. In v2.3.x, Y." → keep current; link to CHANGELOG for history.
- **Grammar sermon.** "It is recommended that the user invoke…" → "Run …". An instruction is a command with one action. Put a condition first, followed by a comma: "To publish the family, run `bun run release:family`."

## When to ask, not write

Stop only when:

- The reader is unclear and you can't infer from the doc's location or context.
- The source material is incomplete or contradictory and the gap matters.
- A non-trivial technical or product claim isn't in the source.

Otherwise, draft. The user can redirect.

## Simplified English (house standard)

### The rules

The rules below govern every word an agent writes: chat replies, reports from agents and subagents,
code comments, and commit bodies. They govern every document too — README, CHANGELOG, report,
runbook, post-mortem, ADR, and PR description. This is mandatory, not a preference. They govern
prose you are writing now. A published CHANGELOG entry is frozen against fact changes, though a
maintainer-approved prose pass may reshape its sentences. Its facts, versions, dates, headings, and
ordering never change, because consumers already downloaded that text and the npm tarball is
immutable. Only the maintainer approves such a pass, and no agent rewrites a published entry as part
of another task.

- **Sentence cap — 25 words.** The cap is ours, not ASD-STE100's. When a sentence runs over, split
  it where it changes fact. Never drop `a`, `an`, or `the` to fit: the cap budgets facts, not
  grammar. Headings, table cells, and list labels are titles, so they carry no cap. Verbatim
  material does not count toward the word budget. The cap counts one prose sentence. An embedded
  list or code sample inside a comment is not one sentence. Count its prose items one by one.
- **One name per thing.** This one is ours too. Do not rotate synonyms for one concept inside one
  document. Take the name from the glossary that owns the subject:
  - `CONTEXT.md` — domain concepts.
  - AGENTS.md §Code Quality — UI vocabulary, and the words it bans.
  - `extensions/README.md` §Vocabulary — popover, toolbar, form, menu.
  - `.cursor/docs/design-system.md` §State language — UI states.

  When a concept has no name yet, add one to the glossary that owns it. Prose about a rename may
  name the superseded term once, so a migration guide can say what it replaced.

- **End every finding with the next step.** Say what to change, or say "no action needed". The
  maintainer reads for two things: what happened, and what to do now.

We adopt no word list. ASD-STE100 pairs its rules with a closed dictionary of approved words. We
reject that dictionary, and no agent should rebuild one here. Those four glossaries are our
dictionary. Ordinary engineering English needs no entry: `gate`, `stale`, `flush`, `drain` and
`clamp` are all fine.

Word choice and sentence shape matter too, and what follows is ours as well. Write one idea per
sentence. Split a sentence that carries more than one em-dash clause. Prefer the common word: `use`
over `utilize`, `show` over `surface`, `check` over `reconcile`. Write no idioms, metaphors, or
figures of speech — write the literal action. Standard domain verbs are not idioms, so a queue
still drops a job.

### Exempt

- **Commit subjects.** A subject is a title, not a sentence, so the cap does not reach it.
  `(build):` deploy triggers are exempt from both rules — `.github/scripts/parse-build-trigger.sh`
  rejects any word outside its list, so `(build): the front back` stops the production deploy.
- **Anything verbatim** — code spans, fenced blocks, quoted errors, commands, SQL, identifiers,
  paths, package names, CSS classes, environment variables, and numbers. Reproduce them exactly.
  Never round a number and never shorten a path.
- **CHANGELOG section headings.** `Highlights`, `Breaking`, `Added`, `Changed`, `Fixed`, `Security`,
  `Removed`, `Documentation` and `Internal` are the CHANGELOG section vocabulary, and
  `RELEASE_POLICY.md` fixes their order. `Added`, `Changed`, `Fixed`, `Security` and `Removed` come
  from Keep a Changelog; `Highlights`, `Breaking`, `Documentation` and `Internal` are ours. Keep a
  Changelog also defines `Deprecated`, which `RELEASE_POLICY.md` does not yet place.
- **The agent rule files** — `AGENTS.md`, every `CLAUDE.md`, `CONTEXT.md`, package-local
  `AGENTS.md`, `.cursor/rules/*.mdc`, `.cursor/docs/*` and `.cursor/skills/*/SKILL.md` — are exempt
  from the cap. The exemption covers only the text already in them. Text you add or edit follows
  the rules. Do not rewrite the existing text as part of another task. AGENTS.md §Workflow And
  Review Expectations forbids compressing `AGENTS.md`. Splitting a sentence is not compression: it
  keeps every article and every fact. One name per thing still applies.

JSDoc and block comments are not an exemption either. The 25-word cap applies to them, and the line
cap in AGENTS.md §Documentation And Comments still applies. The two limits are different: a short
comment can still hold one 40-word sentence. When splitting a sentence would push a block past its
line cap, AGENTS.md §Documentation And Comments already gives the answer. The code or the name is
wrong, so fix that instead.

The `caveman` skill is not an exemption. Simplified English governs chat replies too, so caveman is
off by default. The skill stays available. An explicit user invocation is the user overriding their
own default. It reaches chat replies only, never a file you write.

### Worked example

`extensions/extension-hypermultimedia/CHANGELOG.md`, second sentence of the `[2.0.0]` paragraph. It
ran 52 words, with five of six clauses passive. The maintainer-approved prose pass rewrote it, and
the file now carries the second shape. Write the next entry the same way.

> **Before.** tippy.js is fully retired in favor of Floating UI positioning, node type names are
> normalized to camelCase, the Twitter node is rebranded to X, a Loom node is added, the media
> toolbar is rebuilt around a declarative action registry in the node's top-right corner, and every
> media node gains an editable caption.

> **After.** The kit fully retires tippy.js and positions every surface with Floating UI. It
> renames node types to camelCase, renames the Twitter node to X, and adds a Loom node. The kit
> rebuilds the media toolbar around a declarative action registry, in the node's top-right corner.
> Every media node gains an editable caption.

Four sentences, longest 17 words, every change signal kept.

### Provenance

This section adapts ASD-STE100 Issue 9 (2025), Simplified Technical English. We take the idea, not
the standard: no conformance claim, no rule numbers (published sources disagree on them), and none
of its controlled dictionary. ASD-STE100 is a registered trade mark in the EU. Never label a file or
a package "STE-compliant".

Reference this section by markdown link with the `#simplified-english-house-standard` anchor.
`check:agent-docs` resolves that anchor against this file's headings, so retitling the heading fails
the gate instead of silently breaking every reference.

## Working with other skills

- **`code-janitor` Chain 4** — the in-skill voice table is the lightweight reference; this file is the canonical voice. Code-janitor's JSDoc edits and its Surface 6 disk report both follow the rules here.
- **`commit-review`** — commit messages are documents. Apply the constraints (verb-first, no marketing, no hedges) to the commit subject and body.
