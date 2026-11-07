import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { ImageSource } from '@takumi-rs/core'
import { type Node, text } from '@takumi-rs/helpers'
import { extractEmojis } from '@takumi-rs/helpers/emoji'

const ASSET_DIR = join(import.meta.dir, '../../../../assets/social-card')

export const LOGO_SRC = 'docsplus:logo'
export const BACKGROUND_SRC = 'docsplus:card-background'

/** Inter draws the card. Arimo draws only the glyphs Inter lacks; Takumi falls back per glyph. */
export const CARD_FONTS = [
  { name: 'Inter', file: 'InterVariable.ttf' },
  { name: 'Arimo', file: 'Arimo.ttf' }
] as const

interface Assets {
  fonts: { name: string; data: Buffer }[]
  cmap: Set<number>
  logo: Buffer
  background: Buffer
  twemojiDir: string
}

let assets: Assets | Error | null = null

/**
 * Read once, on the first card request, so REST boots without touching the files. A failure
 * is kept too: the files do not change until a deploy, so no later slug read re-reads them.
 */
export const loadAssets = (): Assets => {
  if (!assets) {
    try {
      const fonts = CARD_FONTS.map(({ name, file }) => ({
        name,
        data: readFileSync(join(ASSET_DIR, file))
      }))
      assets = {
        fonts,
        cmap: new Set(fonts.flatMap(({ data }) => [...readCmap(data)])),
        logo: readFileSync(join(ASSET_DIR, 'logo.svg')),
        background: readFileSync(join(ASSET_DIR, 'card-background.svg')),
        twemojiDir: dirname(Bun.resolveSync('@twemoji/svg/package.json', import.meta.dir))
      }
    } catch (err) {
      assets = err instanceof Error ? err : new Error(String(err))
    }
  }
  if (assets instanceof Error) throw assets
  return assets
}

/** The code points one font maps (cmap format 12, else 3/1 format 4). Takumi boxes any other. */
function readCmap(buf: Buffer): Set<number> {
  const u16 = (o: number) => buf.readUInt16BE(o)
  const u32 = (o: number) => buf.readUInt32BE(o)
  let cmap = -1
  for (let i = 0; i < u16(4); i++) {
    if (buf.toString('latin1', 12 + i * 16, 16 + i * 16) === 'cmap') cmap = u32(12 + i * 16 + 8)
  }
  if (cmap < 0) throw new Error('card font has no cmap table')
  const subs = Array.from({ length: u16(cmap + 2) }, (_, i) => ({
    pid: u16(cmap + 4 + i * 8),
    eid: u16(cmap + 6 + i * 8),
    off: cmap + u32(cmap + 8 + i * 8)
  }))
  const out = new Set<number>()
  const f12 = subs.find((s) => u16(s.off) === 12)
  if (f12) {
    for (let i = 0, n = u32(f12.off + 12); i < n; i++) {
      const g = f12.off + 16 + i * 12
      for (let c = u32(g); c <= u32(g + 4); c++) out.add(c)
    }
    return out
  }
  const f4 = subs.find((s) => s.pid === 3 && s.eid === 1 && u16(s.off) === 4)
  if (!f4) throw new Error('card font has no usable cmap subtable')
  const segX2 = u16(f4.off + 6)
  const ends = f4.off + 14
  const starts = ends + segX2 + 2
  const deltas = starts + segX2
  const ranges = deltas + segX2
  for (let i = 0; i < segX2 / 2; i++) {
    const end = u16(ends + i * 2)
    const start = u16(starts + i * 2)
    const delta = u16(deltas + i * 2)
    const ro = u16(ranges + i * 2)
    for (let c = start; c <= end && c !== 0xffff; c++) {
      const gid = ro === 0 ? (c + delta) & 0xffff : u16(ranges + i * 2 + ro + (c - start) * 2)
      if (gid !== 0) out.add(c)
    }
  }
  return out
}

/** The emoji helper names files the newer Twemoji way; only the last path segment is used. */
const emojiFile = (src: string): string => join(loadAssets().twemojiDir, src.split('/').pop()!)

// The Twemoji set has about 3,700 files; the cap only stops made-up sequences from growing it.
const EMOJI_CHECKS_MAX = 8192
const emojiChecks = new Map<string, boolean>()

/** One file-system check per emoji file, not one per drawn line on the REST event loop. */
const hasEmojiFile = (src: string): boolean => {
  const name = src.split('/').pop()!
  let found = emojiChecks.get(name)
  if (found === undefined) {
    found = existsSync(emojiFile(src))
    if (emojiChecks.size >= EMOJI_CHECKS_MAX) emojiChecks.clear()
    emojiChecks.set(name, found)
  }
  return found
}

const IGNORED = new Set([0x200c, 0x200d, 0xfe0e, 0xfe0f])
const BIDI = /[‪-‮⁦-⁩]/u
const ENGLISH = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]$/u

/**
 * English-only rule for one drawn line. Each character is Latin, Common or Inherited and in a
 * card font, or it is an emoji with a Twemoji file. The same helper splits emoji for the render,
 * so they agree.
 */
export const isDrawable = (line: string): boolean => {
  const { cmap } = loadAssets()
  if (BIDI.test(line)) return false
  const walk = (n: Node): boolean => {
    if (n.type === 'image') return typeof n.src === 'string' && hasEmojiFile(n.src)
    if (n.type === 'text') {
      for (const ch of n.text) {
        const cp = ch.codePointAt(0)!
        if (IGNORED.has(cp)) continue
        if (!ENGLISH.test(ch) || !cmap.has(cp)) return false
      }
      return true
    }
    return (n.children ?? []).every(walk)
  }
  return walk(extractEmojis(text(line), 'twemoji'))
}

/** The image bytes a tree names: the logo, the background and each Twemoji file. No network at render time. */
export const collectImages = (node: Node, out: ImageSource[] = []): ImageSource[] => {
  if (
    node.type === 'image' &&
    typeof node.src === 'string' &&
    !out.some((i) => i.src === node.src)
  ) {
    const { logo, background } = loadAssets()
    const named: Partial<Record<string, Buffer>> = {
      [LOGO_SRC]: logo,
      [BACKGROUND_SRC]: background
    }
    out.push({ src: node.src, data: named[node.src] ?? readFileSync(emojiFile(node.src)) })
  }
  if (node.type === 'container') for (const child of node.children ?? []) collectImages(child, out)
  return out
}
