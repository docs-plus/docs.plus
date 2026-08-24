import type { Page } from 'playwright'

import { headingByTocId, humanPause, pressEnter, typeText } from './actions.ts'

const COMPOSER_INPUT_SELECTOR = '[data-testid="composer-input"]'
const COMPOSER_PROSEMIRROR_SELECTOR = `${COMPOSER_INPUT_SELECTOR} .ProseMirror`

/**
 * Opens the heading chatroom. Prefers the always-present TOC trigger
 * (`.toc__chat-trigger`); falls back to the in-editor heading action (`.ha-chat-btn`),
 * which is `visibility:hidden` until the heading is hovered.
 */
export async function openHeadingChat(page: Page, tocId: string): Promise<void> {
  const tocTrigger = page.locator(`.toc__chat-trigger[data-heading-id="${tocId}"]`).first()
  try {
    await tocTrigger.waitFor({ state: 'visible', timeout: 4_000 })
    await tocTrigger.click()
    return
  } catch {
    // TOC may be collapsed or not yet rebuilt — fall through to the heading action.
  }

  await headingByTocId(page, tocId).hover()
  const chatButton = page
    .locator(`.ha-wrap[data-heading-id="${tocId}"] .ha-chat-btn.ha-single`)
    .first()
  await chatButton.waitFor({ state: 'visible', timeout: 4_000 })
  await chatButton.click()
}

async function waitForComposer(page: Page): Promise<void> {
  await page.locator(COMPOSER_INPUT_SELECTOR).first().waitFor({ state: 'visible', timeout: 15_000 })
}

async function sendChatMessage(page: Page, text: string): Promise<void> {
  await page.locator(COMPOSER_PROSEMIRROR_SELECTOR).first().click()
  await typeText(page, text)
  await pressEnter(page)
  await page.waitForTimeout(300)
}

export async function sendChatLines(page: Page, lines: string[]): Promise<number> {
  await waitForComposer(page)
  let sent = 0
  for (const line of lines) {
    await sendChatMessage(page, line)
    sent += 1
    await humanPause(page)
  }
  return sent
}
