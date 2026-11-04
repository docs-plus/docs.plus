import '../../link-icons/__tests__/setupDom'

import { afterEach, describe, expect, it } from 'bun:test'

import { hideTooltip } from '@docs.plus/floating-tooltip'

import { createBuiltInCard } from '../content'
import type { HovercardRenderContext } from '../types'

// Over the bubble's 400 ms show delay.
const SHOW_WAIT_MS = 450

const ctx = {
  href: 'https://example.com/page',
  link: document.createElement('a'),
  editor: {} as never,
  open: () => {},
  copy: () => Promise.resolve(true),
  applyTitle: () => true,
  state: 'data',
  data: { title: 'Example' }
} as HovercardRenderContext

const hoverLabel = async (button: Element): Promise<string | null> => {
  button.dispatchEvent(new MouseEvent('mouseenter'))
  await new Promise((resolve) => setTimeout(resolve, SHOW_WAIT_MS))
  return document.querySelector('.floating-tooltip.visible')?.textContent ?? null
}

const cards: HTMLElement[] = []
afterEach(() => {
  // Keep the shared bubble in the body: the tooltip module holds on to it.
  hideTooltip()
  for (const el of cards.splice(0)) el.remove()
})

describe('built-in card link line', () => {
  it('names each icon button in the shared bubble, and destroy hides it', async () => {
    const card = createBuiltInCard(ctx, null, undefined)
    document.body.append(card.element)
    cards.push(card.element)
    const [title, copy] = card.element.querySelectorAll('.hyperlink-hovercard__action')

    expect(await hoverLabel(title)).toBe('Use page title')
    expect(await hoverLabel(copy)).toBe('Copy link')

    card.destroy?.()
    expect(document.querySelector('.floating-tooltip.visible')).toBeNull()
  })

  it('adds Use page title when a card that opened loading gets its data', async () => {
    const loading = { ...ctx, state: 'loading', applyTitle: undefined } as HovercardRenderContext
    const card = createBuiltInCard(loading, null, undefined)
    document.body.append(card.element)
    cards.push(card.element)
    expect(card.element.querySelector('[aria-label="Use page title"]')).toBeNull()

    card.setBody?.(ctx, null)
    const title = card.element.querySelector('[aria-label="Use page title"]')
    expect(title).not.toBeNull()
    expect(await hoverLabel(title!)).toBe('Use page title')
  })
})
