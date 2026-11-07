import { describe, expect, it } from 'bun:test'
import { container } from '@takumi-rs/helpers'

import { CARD_FONT, measureFirstChild } from '../infra/renderer'
import { cutLine, widthOf } from '../render/fit'
import { T } from '../render/frame'
import { fitMiddle } from '../render/parts'

/** The fitted title under an eyebrow, with no description: a 297.3 px room. */
const fit = async (line: string) => {
  const { title } = await fitMiddle(line, null, true)
  if (title.type !== 'text') throw new Error('the title is one text node')
  const size = Number(title.style?.fontSize)
  const { height } = await measureFirstChild(
    container({
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        fontFamily: CARD_FONT
      },
      children: [title]
    }),
    T.box.width
  )
  return {
    text: title.text,
    size,
    lines: Math.round(height / (size * T.headline.lineHeight)),
    cut: title.text.endsWith('…')
  }
}

describe('fitMiddle on the title ladder', () => {
  it('keeps a short title at the top step, on one line', async () => {
    expect(await fit('House London')).toMatchObject({ size: 104, lines: 1, cut: false })
  })

  it('steps a long title down to 3 lines at the last step', async () => {
    const title =
      'The Complete Community Handbook for Organising Neighbourhood Repair Cafés in London'
    const head = await fit(title)
    expect(head).toMatchObject({ size: 72, lines: 3, cut: true })
    expect(head.text.endsWith('…')).toBe(true)
  })

  it('breaks a word with no spaces inside the word', async () => {
    expect(await fit('dd6mchik6gfPJOChapter7initialDraftVersion')).toMatchObject({
      size: 88,
      lines: 2,
      cut: false
    })
  })

  it('keeps emoji in the title at the top step', async () => {
    expect(await fit('🚀 Launch Week 🎉 Plan')).toMatchObject({ size: 104, cut: false })
  })

  it('does not cut an emoji title that fills exactly 3 lines at the last step', async () => {
    const title = 'The Big Summer Garden Party Plans for Everyone in the Street Together 🎉'
    expect(await fit(title)).toMatchObject({ size: 72, lines: 3, cut: false })
  })

  it('cuts what no step can hold, ending in "…"', async () => {
    const head = await fit('x'.repeat(400))
    expect(head).toMatchObject({ cut: true })
    expect(head.text.endsWith('…')).toBe(true)
  })
})

describe('cutLine', () => {
  it('never leaves a stop before the "…"', async () => {
    const { size, weight } = T.desc
    const cut = async (line: string, room: string) =>
      (await cutLine(line, await widthOf(room, size, weight), size, weight)).text
    expect(await cut('Done.Next', 'Done.…')).toBe('Done…')
    expect(await cut('Plans for the day. Then we eat', 'Plans for the day. Th…')).toBe(
      'Plans for the day…'
    )
  })
})
