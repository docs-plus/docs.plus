// README hero GIF — `bun run docs:gif` (needs ffmpeg). Story: link icon, hovercard, Mod-k create,
// paste title, Mod-k preview, edit. `?demo=on` serves the icons, the card and the title from
// test/playground/icons/demo. A key badge under the editor shows each shortcut as it is pressed.
import { resolve } from 'node:path'

import { recordDemo } from '@docs.plus/playground/recordDemo'
import type { Page } from 'playwright'

const ISSUE = 'https://github.com/docs-plus/docs.plus/issues/242'
const REPO = 'https://github.com/docs-plus/docs.plus'
const CARD = '.floating-popover.visible .hyperlink-hovercard'
const PREVIEW = '.hyperlink-preview-popover'
const EDIT = '.hyperlink-edit-popover'

// Draws the keys under the playground card, inside the GIF crop. Recording-only DOM.
const showKeys = (page: Page, keys: string[]): Promise<void> =>
  page.evaluate((keys) => {
    let badge = document.getElementById('demo-keys')
    if (!badge) {
      badge = document.createElement('div')
      badge.id = 'demo-keys'
      Object.assign(badge.style, {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: '10px',
        background: 'rgba(15, 23, 42, 0.88)',
        color: '#ffffff',
        font: '600 15px Helvetica, Arial, sans-serif',
        zIndex: '2147483646',
        transition: 'opacity 120ms',
        pointerEvents: 'none'
      })
      document.body.appendChild(badge)
    }
    const main = document.querySelector('main')!.getBoundingClientRect()
    badge.style.top = `${Math.round(main.bottom + 14)}px`
    badge.replaceChildren(
      ...keys.map((k) => {
        const kbd = document.createElement('kbd')
        kbd.textContent = k
        Object.assign(kbd.style, {
          font: 'inherit',
          minWidth: '22px',
          textAlign: 'center',
          padding: '3px 8px',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.16)',
          border: '1px solid rgba(255, 255, 255, 0.28)'
        })
        return kbd
      })
    )
    badge.style.opacity = '1'
  }, keys)

const hideKeys = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const badge = document.getElementById('demo-keys')
    if (badge) badge.style.opacity = '0'
  })

await recordDemo({
  url: 'http://127.0.0.1:5173/?demo=on',
  packageRoot: resolve(import.meta.dir, '../..'),
  // Taller than the old 5:3, so the open hovercard and the key badge fit inside the frame. The
  // crop needs a viewport at least as tall as itself.
  aspect: 1.25,
  viewportHeight: 760,
  async story({ page, cursor, mark, sleep }) {
    const press = async (keys: string[], combo: string): Promise<void> => {
      await showKeys(page, keys)
      await sleep(350)
      await page.keyboard.press(combo)
      await sleep(550)
      await hideKeys(page)
    }

    await sleep(400)
    mark('start')
    await cursor.show()
    await sleep(300)
    const pm = (await page.locator('#editor .ProseMirror').boundingBox())!
    await cursor.moveTo(pm.x + 60, pm.y + 30)
    await cursor.click()
    await sleep(250)

    // 1. The trailing space turns the address into a link, with the site icon before it.
    await page.keyboard.type('Read the guide on docs.plus/demo ', { delay: 50 })
    const demo = page.locator('#editor a', { hasText: 'docs.plus/demo' })
    await demo.locator('.hyperlink-icon').waitFor()
    await sleep(400)

    // 2. Rest the pointer on the link: the hovercard opens with no click.
    const box = (await demo.boundingBox())!
    await cursor.moveTo(box.x + box.width * 0.6, box.y + box.height / 2)
    await page.locator(`${CARD} .hyperlink-hovercard__image[data-state="ready"]`).waitFor()
    await sleep(1700)
    // Leave upward: the card opens below the link and can cover the rest of the editor.
    await cursor.moveTo(pm.x + pm.width - 120, pm.y - 30, 8)
    await page.locator(CARD).waitFor({ state: 'hidden' })
    await sleep(200)

    // 3. Select a word and press Mod-k: the create form opens, and Enter makes the link.
    const word = (await page
      .locator('#editor p')
      .first()
      .evaluate((p) => {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
          const i = n.data.indexOf('guide')
          if (i < 0) continue
          const r = document.createRange()
          r.setStart(n, i)
          r.setEnd(n, i + 5)
          return r.getBoundingClientRect().toJSON() as DOMRect
        }
        return null
      }))!
    await cursor.moveTo(word.x + word.width / 2, word.y + word.height / 2)
    await sleep(150)
    await cursor.dblclick()
    // ProseMirror reads the DOM selection on the next selectionchange.
    await sleep(300)
    await press(['⌘', 'K'], 'ControlOrMeta+KeyK')
    await page.locator('.hyperlink-create-popover').waitFor({ state: 'visible' })
    await cursor.moveTo(word.x + word.width / 2 + 200, word.y + 150, 8)
    await page.keyboard.type(REPO, { delay: 30 })
    await sleep(250)
    await press(['Enter'], 'Enter')
    await page.locator('#editor a', { hasText: 'guide' }).locator('.hyperlink-icon').waitFor()
    await sleep(600)

    // 4. Paste a bare address on its own line: it shows at once, then takes the page title.
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await showKeys(page, ['⌘', 'V'])
    await sleep(350)
    await page.evaluate((href) => {
      const data = new DataTransfer()
      data.setData('text/plain', href)
      document
        .querySelector('#editor .ProseMirror')!
        .dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
        )
    }, ISSUE)
    await sleep(550)
    await hideKeys(page)
    await page.locator('#editor a', { hasText: 'RFC: Desktop hyperlink hovercard' }).waitFor()
    await sleep(1200)

    // 5. Mod-k with the caret inside a link opens that link's preview.
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft')
    await sleep(150)
    await press(['⌘', 'K'], 'ControlOrMeta+KeyK')
    await page.locator(PREVIEW).waitFor({ state: 'visible' })
    await sleep(900)

    // 6. Edit: rename the link in place, and its address stays.
    const edit = (await page.locator(`${PREVIEW} .edit`).boundingBox())!
    await cursor.moveTo(edit.x + edit.width / 2, edit.y + edit.height / 2, 10)
    await sleep(150)
    await cursor.click()
    const text = page.locator(`${EDIT} input[placeholder="Enter link text"]`)
    await text.waitFor({ state: 'visible' })
    const field = (await text.boundingBox())!
    await cursor.moveTo(field.x + field.width / 2, field.y + field.height / 2, 8)
    await sleep(150)
    await text.focus()
    await page.keyboard.press('ControlOrMeta+KeyA')
    await sleep(200)
    await page.keyboard.type('Hovercard RFC', { delay: 45 })
    await sleep(300)
    await press(['Enter'], 'Enter')
    await page.locator('#editor a', { hasText: 'Hovercard RFC' }).waitFor()
    await cursor.moveTo(pm.x + pm.width - 120, pm.y - 30, 8)
    await sleep(1500)
    mark('end')
  }
})
