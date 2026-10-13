// Writes a docs.plus-style QR code as one inline SVG, for a release banner.
// The drawing rules come from the app itself, so the banner always matches QrCode.tsx.
// Usage: bun <this file> <url> <out.svg>
import {
  buildModulePath,
  encodeQr,
  finderOrigins,
  finderRingPath
} from '../../../../apps/webapp/src/utils/qrCodePaths'

const [url, out] = process.argv.slice(2)
if (!url || !out) throw new Error('usage: bun qr-svg.ts <url> <out.svg>')

const { data, size } = encodeQr(url)
// Ink and eye colours are the app's --qr-ink and --qr-eye tokens (styles/globals.scss).
const finders = finderOrigins(size)
  .map(
    ([x, y]) =>
      `<path d="${finderRingPath(x, y)}" fill-rule="evenodd" fill="#0B1F4D"></path>` +
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="#1A56DB"></rect>`
  )
  .join('')

await Bun.write(
  out,
  `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" aria-hidden="true" style="display: block">` +
    `<path d="${buildModulePath(data)}" fill="#0B1F4D"></path>${finders}</svg>`
)
console.log(`wrote ${out} (${size}x${size} modules)`)
