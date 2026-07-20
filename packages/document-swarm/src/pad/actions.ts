import type { Locator, Page } from 'playwright'

// DOM vocabulary for the collaborative pad. The contenteditable host carries both
// `.tiptap` and `.ProseMirror`; the wrapper is `.docy_editor` (EditorContent.tsx).
// Source: apps/webapp cypress specs drive `.docy_editor > .tiptap.ProseMirror`.
export const PAD_EDITOR_SELECTOR = '.docy_editor .tiptap.ProseMirror'
export const PAD_EDITOR_EDITABLE_SELECTOR = `${PAD_EDITOR_SELECTOR}[contenteditable="true"]`
export const PAD_HEADING_SELECTOR = `${PAD_EDITOR_SELECTOR} :is(h1, h2, h3, h4, h5, h6)[data-toc-id]`

// A small per-keystroke delay keeps input rules (`# `, `[] `, `1. `) firing through
// the real beforeinput pipeline and makes a headed Demo run watchable.
export const TYPE_DELAY_MS = 22

/** Locates a heading by its ProseMirror UniqueID (`data-toc-id`). */
export function headingByTocId(page: Page, tocId: string): Locator {
  return page.locator(`${PAD_EDITOR_SELECTOR} [data-toc-id="${tocId}"]`).first()
}

/** Click into the editable pad so subsequent keyboard actions land in ProseMirror. */
export async function focusEditor(page: Page): Promise<void> {
  await page.locator(PAD_EDITOR_EDITABLE_SELECTOR).first().click()
}

/** Real keyboard typing so TipTap input rules fire (unlike a programmatic insert). */
export async function typeText(
  page: Page,
  text: string,
  options: { delay?: number } = {}
): Promise<void> {
  await page.keyboard.type(text, { delay: options.delay ?? TYPE_DELAY_MS })
}

export async function pressEnter(page: Page): Promise<void> {
  await page.keyboard.press('Enter')
}

// Marks toggle around a following (or selected) run. `ControlOrMeta` maps to ⌘ on
// macOS and Ctrl elsewhere, matching StarterKit's Mod-b / Mod-i shortcuts.
export async function toggleBold(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+b')
}

export async function toggleItalic(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+i')
}

// Move to the end of the document WITHOUT selecting anything. macOS Chromium binds
// document-end to Cmd+ArrowDown; elsewhere it is Ctrl+End. Never Ctrl+A — a stray
// keystroke over a whole-document selection is what wiped the pad.
export async function moveCaretToDocEnd(page: Page): Promise<void> {
  await focusEditor(page)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End')
  await assertCollapsedSelection(page)
}

/** True when the editor selection is a caret (no range). Reads the live browser selection. */
export async function selectionIsCollapsed(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const selection = (
      globalThis as unknown as { getSelection?: () => { isCollapsed: boolean } | null }
    ).getSelection?.()
    return selection ? selection.isCollapsed : true
  })
}

/** Refuses to proceed while a range is selected, so a following keystroke can never
 *  replace document content. Collapses a stray range once, then hard-fails. */
export async function assertCollapsedSelection(page: Page): Promise<void> {
  if (await selectionIsCollapsed(page)) return
  await page.keyboard.press('ArrowRight')
  if (await selectionIsCollapsed(page)) return
  throw new Error(
    'Refusing to type over a non-collapsed selection (would replace document content).'
  )
}

/** Turns the current line into a checklist (`[] ` input rule) and types each item. */
export async function insertTaskList(page: Page, items: string[]): Promise<void> {
  if (items.length === 0) return
  await typeText(page, '[] ')
  for (const [index, item] of items.entries()) {
    if (index > 0) await pressEnter(page)
    await typeText(page, item)
  }
}

/** Small randomized pause so a headed run reads like a person, not a firehose. */
export async function humanPause(page: Page, minMs = 120, maxMs = 420): Promise<void> {
  const span = Math.max(0, maxMs - minMs)
  await page.waitForTimeout(minMs + Math.floor(Math.random() * (span + 1)))
}
