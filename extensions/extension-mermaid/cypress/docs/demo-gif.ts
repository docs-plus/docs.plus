// README hero GIF — `bun run docs:gif` (needs ffmpeg). Story: edit a radar chart live, then hide the source.
import { resolve } from 'node:path'

import { recordDemo } from '@docs.plus/playground/recordDemo'
import type { Editor } from '@tiptap/core'

const SOURCE = [
  'radar-beta',
  '  title Team skills',
  '  axis a["Design"], b["Code"], c["Docs"], d["Tests"], e["Ops"]',
  '  curve x["Ana"]{4, 5, 3, 4, 2}',
  '  curve y["Ben"]{3, 3, 5, 2, 4}',
  '  max 5'
].join('\n')

const READY = '#editor .mermaid-diagram [data-state="ready"] svg'

await recordDemo({
  url: 'http://127.0.0.1:5178/',
  packageRoot: resolve(import.meta.dir, '../..'),
  viewportHeight: 1000,
  fps: 10,
  colors: 128,
  dither: 'bayer:bayer_scale=4',
  async story({ page, cursor, mark, sleep }) {
    // Top-align the card so it grows downward instead of from its middle.
    await page.addStyleTag({ content: 'body{justify-content:flex-start}' })
    await page.evaluate((source) => {
      const esc = source.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      window._editor!.commands.setContent(
        `<p>Rate the team in plain text. The chart redraws as you type.</p><pre><code class="language-mermaid">${esc}</code></pre>`
      )
    }, SOURCE)
    await page.locator(READY).waitFor()
    await sleep(500)
    mark('start')
    await cursor.show()
    await sleep(500)

    // The box of `text` inside the source, from its `from` offset to `from + length`.
    const textBox = (text: string, from: number, length: number) =>
      page.locator('#editor pre').evaluate(
        (pre, [t, f, n]) => {
          const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT)
          for (
            let node = walker.nextNode() as Text | null;
            node;
            node = walker.nextNode() as Text | null
          ) {
            const i = node.data.indexOf(t as string)
            if (i < 0) continue
            const r = document.createRange()
            r.setStart(node, i + (f as number))
            r.setEnd(node, i + (f as number) + (n as number))
            return r.getBoundingClientRect().toJSON() as DOMRect
          }
          return null
        },
        [text, from, length] as const
      )

    // Ana's Ops score: 2 becomes 5, and the blue shape reaches for Ops.
    const ops = (await textBox('{4, 5, 3, 4, 2}', 13, 1))!
    await cursor.moveTo(ops.x + ops.width / 2, ops.y + ops.height / 2)
    await sleep(200)
    await cursor.click()
    // A double-click in a code line can select the brace instead, so select the digit by position.
    await page.evaluate(() => {
      const editor = window._editor as unknown as Editor
      let from = -1
      editor.state.doc.descendants((node, pos) => {
        const i = node.text?.indexOf('{4, 5, 3, 4, 2}') ?? -1
        if (i >= 0) from = pos + i + 13
      })
      editor.commands.setTextSelection({ from, to: from + 1 })
    })
    await sleep(250)
    await page.keyboard.type('5', { delay: 80 })
    await sleep(1400)

    // A third curve. Steady typing stays under the 300 ms redraw delay, so no half line draws.
    const ben = (await textBox('{3, 3, 5, 2, 4}', 15, 0))!
    await cursor.moveTo(ben.x + 40, ben.y + ben.height / 2)
    await sleep(150)
    await cursor.click()
    await sleep(250)
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('  curve z["Cleo"]{5, 2, 4, 5, 3}', { delay: 55 })
    await page.locator(READY, { hasText: 'Cleo' }).waitFor()
    mark('tall')
    await sleep(1500)

    // Hover shows the actions; Hide source leaves only the chart.
    const fold = (await page.locator('#editor .mermaid-diagram__fold').boundingBox())!
    await cursor.moveTo(fold.x + fold.width / 2, fold.y + fold.height / 2 + 120, 10)
    await sleep(300)
    await cursor.moveTo(fold.x + fold.width / 2, fold.y + fold.height / 2, 10)
    await sleep(400)
    await cursor.click()
    await page.locator('#editor .mermaid-diagram[data-source="folded"]').waitFor()
    await sleep(300)
    const chart = (await page.locator(READY).boundingBox())!
    await cursor.moveTo(chart.x + chart.width - 40, chart.y + chart.height - 20, 12)
    await sleep(2000)
    mark('end')
  }
})
