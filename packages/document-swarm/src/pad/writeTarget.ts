import type { Page } from 'playwright'

import type { ActorRecord, Contention, WriteTarget } from '../types.ts'
import {
  assertCollapsedSelection,
  headingByTocId,
  moveCaretToDocEnd,
  PAD_HEADING_SELECTOR,
  pressEnter,
  typeText
} from './actions.ts'
import { SwarmPadError } from './waitForPad.ts'

const HOTSPOT_SECTION_LABEL = 'Swarm — Hotspot'

/** Heading labels stay module-private — never part of ScriptContext. */
const writeTargetLabels = new WeakMap<WriteTarget, string>()

function sectionLabelForActor(displayName: string): string {
  return `Swarm — ${displayName}`
}

function labelOf(target: WriteTarget): string {
  const label = writeTargetLabels.get(target)
  if (!label) throw new Error('Invalid WriteTarget (not created by assignWriteTarget).')
  return label
}

/** Builds the actor's Write Target from Contention policy (orchestrator-only). */
export function assignWriteTarget(actor: ActorRecord, contention: Contention): WriteTarget {
  const label =
    contention === 'high' ? HOTSPOT_SECTION_LABEL : sectionLabelForActor(actor.displayName)
  const target: WriteTarget = { __brand: 'WriteTarget' }
  writeTargetLabels.set(target, label)
  return target
}

export type OpenedWriteTarget = {
  /** ProseMirror UniqueID (`data-toc-id`) — opens heading chat. */
  tocId: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Match the heading by its leading text. Anchoring at the start with a whitespace/end
// boundary is deliberate: HeadingActions appends widget buttons INSIDE the heading, so
// its raw textContent is `"<label>\n   \n…"` — a `^label$` match never lands, and the
// boundary still separates "Swarm Actor 1" from "Swarm Actor 10".
async function findHeadingTocId(page: Page, label: string): Promise<string | null> {
  const heading = page
    .locator(PAD_HEADING_SELECTOR)
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}(?:\\s|$)`) })
    .first()
  if ((await heading.count()) === 0) return null
  return heading.getAttribute('data-toc-id')
}

// UniqueID assigns `data-toc-id` on a transaction after the heading text lands, so a
// freshly created heading needs a short poll before its id is queryable.
async function waitForHeadingTocId(
  page: Page,
  label: string,
  timeoutMs = 8_000
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const tocId = await findHeadingTocId(page, label)
    if (tocId) return tocId
    if (Date.now() > deadline) return null
    await page.waitForTimeout(150)
  }
}

async function ensureSectionHeading(page: Page, label: string): Promise<string> {
  const existing = await findHeadingTocId(page, label)
  if (existing) return existing

  await moveCaretToDocEnd(page)
  await pressEnter(page)
  await typeText(page, '## ') // markdown input rule → H2
  await typeText(page, label)

  const created = await waitForHeadingTocId(page, label)
  if (!created) {
    throw new SwarmPadError(`Could not create or resolve the section heading "${label}".`)
  }
  return created
}

/**
 * Ensures the Write Target heading exists (creating it at doc end if missing) and
 * leaves the caret at the end of that heading, ready for a body line to be typed.
 */
export async function openWriteTarget(page: Page, target: WriteTarget): Promise<OpenedWriteTarget> {
  const tocId = await ensureSectionHeading(page, labelOf(target))

  const heading = headingByTocId(page, tocId)
  await heading.click()
  await page.keyboard.press('End')
  // The script types immediately after this returns — never over a range selection.
  await assertCollapsedSelection(page)

  return { tocId }
}
