// README hero GIF — `bun run docs:gif` (needs ffmpeg). Story: autolink, preview, Mod-k create.
import { resolve } from 'node:path'

import { recordDemo } from '@docs.plus/playground/recordDemo'

await recordDemo({
  url: 'http://127.0.0.1:5173/',
  packageRoot: resolve(import.meta.dir, '../..'),
  aspect: 5 / 3,
  async story({ page, cursor, mark, sleep }) {
    await sleep(400)
    mark('start')
    await cursor.show()
    await sleep(300)
    const pm = (await page.locator('#editor .ProseMirror').boundingBox())!
    await cursor.moveTo(pm.x + 60, pm.y + 30)
    await cursor.click()
    await sleep(250)

    // The trailing space turns docs.plus into a link.
    await page.keyboard.type('Read the guide on docs.plus ', { delay: 65 })
    await page.locator('#editor a', { hasText: 'docs.plus' }).waitFor()
    await sleep(450)

    const link = (await page.locator('#editor a', { hasText: 'docs.plus' }).boundingBox())!
    await cursor.moveTo(link.x + link.width / 2, link.y + link.height / 2)
    await sleep(150)
    await cursor.click()
    await page.locator('.hyperlink-preview-popover').waitFor({ state: 'visible' })
    await sleep(1200)

    // Escape needs focus inside the popover, so close it with an outside click.
    await cursor.moveTo(pm.x + pm.width - 160, pm.y + pm.height - 50)
    await sleep(120)
    await cursor.click()
    await page.locator('.hyperlink-preview-popover').waitFor({ state: 'hidden' })
    await sleep(250)

    const word = (await page.locator('#editor p').evaluate((p) => {
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
    await page.keyboard.press('ControlOrMeta+KeyK')
    await page.locator('.hyperlink-create-popover').waitFor({ state: 'visible' })
    await cursor.moveTo(word.x + word.width / 2 + 180, word.y + 150, 8)
    await page.keyboard.type('https://docs.plus/guide', { delay: 60 })
    await sleep(350)
    await page.keyboard.press('Enter')
    await page.locator('#editor a', { hasText: 'guide' }).waitFor()
    await sleep(700)
    await cursor.moveTo(pm.x + pm.width - 200, pm.y + pm.height - 60, 8)
    await cursor.click()
    await sleep(1300)
    mark('end')
  }
})
