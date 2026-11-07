import type { Node, Renderer } from '@takumi-rs/core'
import { extractEmojis } from '@takumi-rs/helpers/emoji'

import { CARD_FONTS, collectImages, loadAssets } from './assets'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630
export const CARD_FONT = CARD_FONTS.map((f) => f.name).join(', ')

let renderer: Promise<Renderer> | null = null

// Loaded on the first render, so a missing native binary fails one card, not the REST boot.
const getRenderer = (): Promise<Renderer> => {
  renderer ??= (async () => {
    const { Renderer } = await import('@takumi-rs/core')
    // 8 MiB covers the logo and the emoji the cards draw. Registered fonts sit outside it.
    const r = new Renderer({ cacheMaxBytes: 8 * 1024 * 1024 })
    for (const font of loadAssets().fonts) await r.registerFont(font)
    return r
  })().catch((err: unknown) => {
    renderer = null
    throw err
  })
  return renderer
}

const prepare = (tree: Node) => {
  const node = extractEmojis(tree, 'twemoji')
  return { node, images: collectImages(node) }
}

/** Lays a tree out at `width` and returns the first child's size: the fit's one probe. */
export const measureFirstChild = async (
  tree: Node,
  width: number
): Promise<{ width: number; height: number }> => {
  const { node, images } = prepare(tree)
  const measured = await (await getRenderer()).measure(node, { width, height: 4000, images })
  const first = measured.children[0]
  return { width: first?.width ?? 0, height: first?.height ?? 0 }
}

export const renderPng = async (tree: Node): Promise<Uint8Array<ArrayBuffer>> => {
  const { node, images } = prepare(tree)
  return (await getRenderer()).render(node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    format: 'png',
    images
  })
}
