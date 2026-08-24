import { pressEnter, typeText } from '../pad/actions.ts'
import { SwarmPadError } from '../pad/waitForPad.ts'
import { openWriteTarget } from '../pad/writeTarget.ts'
import type { SwarmScript } from '../types.ts'

type OutlineBlock =
  { kind: 'heading'; level: 2 | 3; text: string } | { kind: 'paragraph'; text: string }

/** Not a markdown importer — heading/paragraph blocks only. */
function parseOutline(markdown: string): OutlineBlock[] {
  const blocks: OutlineBlock[] = []
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const headingMatch = /^(#{2,3})\s+(.+)$/.exec(line)
    if (headingMatch) {
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length === 3 ? 3 : 2,
        text: headingMatch[2].trim()
      })
    } else {
      blocks.push({ kind: 'paragraph', text: line })
    }
  }
  return blocks
}

async function loadAcademyOutline(): Promise<OutlineBlock[]> {
  const fixture = await Bun.file(new URL('../fixtures/academy.md', import.meta.url)).text()
  return parseOutline(fixture)
}

export const academyScript: SwarmScript = {
  name: 'academy',
  run: async (ctx) => {
    const { page, writeTarget } = ctx
    const outline = await loadAcademyOutline()
    if (outline.length === 0) throw new SwarmPadError('Academy fixture produced no outline blocks.')

    await openWriteTarget(page, writeTarget)
    await pressEnter(page)

    for (const [index, block] of outline.entries()) {
      if (index > 0) await pressEnter(page)
      if (block.kind === 'heading') {
        await typeText(page, `${'#'.repeat(block.level)} `) // markdown input rule → H2/H3
      }
      await typeText(page, block.text)
    }
  }
}
