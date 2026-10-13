// The house QR drawing rules. QrCode.tsx renders them, and the release banner script
// (.cursor/skills/release-product/scripts/qr-svg.ts) imports them, so keep this file alias-free.
import { encode } from 'uqr'

export const FINDER_SIZE = 7

/** The house encoding: error correction M, and no built-in margin (the frame adds one). */
export const encodeQr = (value: string) => encode(value, { ecc: 'M', border: 0 })

const isFinder = (x: number, y: number, size: number) =>
  (x < FINDER_SIZE && y < FINDER_SIZE) ||
  (x >= size - FINDER_SIZE && y < FINDER_SIZE) ||
  (x < FINDER_SIZE && y >= size - FINDER_SIZE)

/** Top-left corner of each of the three finder patterns. */
export const finderOrigins = (size: number): [number, number][] => [
  [0, 0],
  [size - FINDER_SIZE, 0],
  [0, size - FINDER_SIZE]
]

/** Round dots, bridged to dark right/down neighbours, so runs read as fluid strokes. */
export function buildModulePath(data: boolean[][]): string {
  const size = data.length
  const isDark = (x: number, y: number) =>
    x < size && y < size && data[y][x] && !isFinder(x, y, size)

  let path = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isDark(x, y)) continue
      path += `M${x + 0.5} ${y}a.5 .5 0 0 1 0 1a.5 .5 0 0 1 0-1z`
      if (isDark(x + 1, y)) path += `M${x + 0.5} ${y}h1v1h-1z`
      if (isDark(x, y + 1)) path += `M${x} ${y + 0.5}h1v1h-1z`
    }
  }
  return path
}

/** Rounded 7×7 finder ring. It keeps the 1:1:3:1:1 ratio that scanners locate. */
export const finderRingPath = (x: number, y: number) =>
  `M${x + 2} ${y}h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z` +
  `M${x + 2} ${y + 1}a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z`
