import type { JSONContent } from '@tiptap/core'
import type * as Pele from 'pele'

// The pad draws a code block only when its language is exactly this (extension-mermaid).
const MERMAID_LANGUAGE = 'mermaid'

// Mirrors DEFAULT_LIMITS in extensions/extension-mermaid/src/constants.ts, which the pad uses.
// Change both together, or the pad shows "too large to draw" for a diagram this lets through.
const LIMITS = { limit: 15000, maxEdges: 500 } satisfies Pele.ParseOptions

/** Each was checked with `pele.parse`. Pele draws more types; these are the ones we name. */
export const DIAGRAM_KEYWORDS = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'gitGraph',
  'journey',
  'quadrantChart',
  'xychart-beta',
  'kanban'
]

const isDiagram = (node: JSONContent): boolean =>
  node.type === 'codeBlock' && node.attrs?.language === MERMAID_LANGUAGE

const sourceOf = (node: JSONContent): string =>
  (node.content ?? []).map((child) => child.text ?? '').join('')

// At any depth: a fence can sit in a list item.
const diagramSources = (nodes: readonly JSONContent[]): string[] =>
  nodes.flatMap((node) => (isDiagram(node) ? [sourceOf(node)] : diagramSources(node.content ?? [])))

// Pele counts lines from the diagram header and skips comments, so its line number misleads.
// The caret stays.
const tidy = (message: string): string =>
  message
    .replace(/ on line \d+/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .slice(0, 400)

// Why the pad could not draw `source`, or null when it can. Parse only, no layout.
const problemOf = async (source: string): Promise<string | null> => {
  if (source.trim() === '') return 'It is empty.'
  const pele = await import('pele')
  try {
    pele.parse(source, LIMITS)
    return null
  } catch (err) {
    // Not the agent's mistake: `run` logs it and answers with its generic failure.
    if (!(err instanceof pele.PeleError)) throw err
    if (err.code === 'unsupported-diagram') {
      return `Pele found no diagram type. Start it with one of: ${DIAGRAM_KEYWORDS.join(', ')}.`
    }
    if (err.code === 'limit') {
      return `It is over ${LIMITS.limit} characters or ${LIMITS.maxEdges} edges, the most the pad draws.`
    }
    return `Pele could not parse it: ${tidy(err.message)}`
  }
}

/** The first diagram in `nodes` the pad could not draw, named by its place among the diagrams. */
export const checkDiagrams = async (nodes: readonly JSONContent[]): Promise<string | null> => {
  const sources = diagramSources(nodes)
  for (const [index, source] of sources.entries()) {
    const problem = await problemOf(source)
    if (problem) {
      const name = sources.length === 1 ? 'the diagram' : `diagram ${index + 1}`
      return `${name} cannot be drawn. ${problem}`
    }
  }
  return null
}

/**
 * A code block is one text run and `oldText` is unique in the section, so the diagram
 * that holds it is the one this edit changes. Why it could not be drawn after the edit, or null.
 */
export const checkReplacedDiagram = async (
  nodes: readonly JSONContent[],
  oldText: string,
  newText: string
): Promise<string | null> => {
  const source = diagramSources(nodes).find((text) => text.includes(oldText))
  if (source === undefined) return null
  // A function, so a `$&` in newText stays literal.
  const problem = await problemOf(source.replace(oldText, () => newText))
  return problem && `after this change, the diagram cannot be drawn. ${problem}`
}
