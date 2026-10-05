// README hero GIF — `bun run docs:gif` (needs ffmpeg). Story: paste a YouTube URL, then resize it.
import { resolve } from 'node:path'

import { recordDemo } from '@docs.plus/playground/recordDemo'

import { README_YOUTUBE } from './readmeMedia'

const MEDIA = '#editor .hypermultimedia--youtube__content'

await recordDemo({
  url: 'http://127.0.0.1:5174/',
  packageRoot: resolve(import.meta.dir, '../..'),
  viewportHeight: 720,
  fps: 12,
  dither: 'bayer:bayer_scale=4',
  // The embed shell loads for about 3 s; keep about 1 s of it.
  cut: (m) => [m.paste + 1.1, m.ready - 0.1],
  async story({ page, cursor, mark, sleep }) {
    // Top-align the card so it grows downward on paste instead of from its middle.
    await page.addStyleTag({ content: 'body{justify-content:flex-start}' })
    await sleep(400)
    mark('start')
    await cursor.show()
    await sleep(250)
    const pm = (await page.locator('#editor .ProseMirror').boundingBox())!
    await cursor.moveTo(pm.x + 60, pm.y + 24)
    await cursor.click()
    await sleep(350)

    await page.evaluate((url) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', url)
      const paste = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      })
      document.querySelector('#editor .ProseMirror')!.dispatchEvent(paste)
    }, README_YOUTUBE)
    mark('paste')
    await cursor.moveTo(pm.x + pm.width - 30, pm.y + pm.height + 30, 10)
    await page
      .locator(`${MEDIA} .hm-media-host[data-hm-loading="ready"]`)
      .waitFor({ state: 'attached', timeout: 30000 })
    mark('ready')
    await sleep(1200)

    // Hover so the toolbar and the grippers show.
    const box = (await page.locator(MEDIA).boundingBox())!
    await cursor.moveTo(box.x + box.width / 2, box.y + box.height - 12)
    await page
      .locator('#editor .hypermultimedia__resize-gripper--active')
      .waitFor({ state: 'attached' })
    await page.locator('#editor .media-toolbar').waitFor({ state: 'visible' })
    await sleep(700)

    const gripper = '#editor .hypermultimedia__resize-gripper--active'
    const frame = (await page.locator(gripper).boundingBox())!
    const clamp = (await page
      .locator(`${gripper} .media-resize-clamp--bottom-right`)
      .boundingBox())!
    const cx = clamp.x + clamp.width / 2
    const cy = clamp.y + clamp.height / 2
    // A corner drag keeps the ratio (#379). Drag along the diagonal so the corner stays under the cursor.
    const dx = -Math.round(frame.width * 0.3)
    const dy = Math.round((dx * frame.height) / frame.width)
    await cursor.moveTo(cx, cy)
    await sleep(250)
    await cursor.down()
    await sleep(120)
    await cursor.moveTo(cx + dx, cy + dy, 40, 20)
    await sleep(120)
    await cursor.up()
    await sleep(350)
    // Rest on the new bottom edge so the toolbar and grippers stay in view.
    const after = (await page.locator(MEDIA).boundingBox())!
    await cursor.moveTo(after.x + after.width / 2 + 60, after.y + after.height - 6, 12)
    await sleep(1500)
    mark('end')
  }
})
