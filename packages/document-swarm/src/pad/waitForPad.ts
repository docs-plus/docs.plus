import type { Page } from 'playwright'

import { PAD_EDITOR_EDITABLE_SELECTOR, PAD_HEADING_SELECTOR } from './actions.ts'

/** Thrown when the pad never becomes editable — gate, sync failure, or timeout. */
export class SwarmPadError extends Error {}

export type WaitForPadOptions = { timeoutMs?: number }

// PrivateDocumentGate (apps/webapp/.../PrivateDocumentGate.tsx) has no test id, so it is
// detected by its two fixed titles. The apostrophe in the access-denied copy is a curly
// quote, so match a stable substring instead of the whole sentence.
const GATE_PRIVATE_TITLE = 'This document is private'
const GATE_DENIED_TITLE = /have access to this document/i

/**
 * Resolves once the collaborative editor is mounted and editable, past the SSR
 * skeleton and provider sync. Throws `SwarmPadError` if the Swarm Target shows a
 * Private/access gate or never becomes ready within the timeout.
 */
export async function waitForPad(page: Page, options: WaitForPadOptions = {}): Promise<void> {
  const timeout = options.timeoutMs ?? 30_000
  const editor = page.locator(PAD_EDITOR_EDITABLE_SELECTOR)
  const gate = page.getByText(GATE_PRIVATE_TITLE).or(page.getByText(GATE_DENIED_TITLE))

  try {
    await editor.or(gate).first().waitFor({ state: 'visible', timeout })
  } catch {
    throw new SwarmPadError(
      `Swarm Target did not render an editor within ${timeout}ms (still loading or unreachable).`
    )
  }

  if (await gate.first().isVisible()) {
    throw new SwarmPadError(
      'Swarm Target is showing a Private/access gate — the swarm requires a public, editable document.'
    )
  }

  // The editable host and the mandatory title heading confirm ProseMirror has content
  // before any actor starts typing (avoids racing the first onSynced).
  await editor.first().waitFor({ state: 'visible', timeout })
  await page.locator(PAD_HEADING_SELECTOR).first().waitFor({ state: 'visible', timeout })
}
