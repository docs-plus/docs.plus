#!/usr/bin/env bun
/* global console, process */

/**
 * PWA Icon Generator for Docs.plus
 *
 * Generates all required icon sizes for iOS and Android from SVG sources.
 * Uses sharp for high-quality rasterization.
 *
 * Usage:
 *   bun scripts/generate-icons.mjs
 *
 * Prerequisites:
 *   sharp (already a webapp devDependency)
 *
 * Icon Specifications:
 * ─────────────────────────────────────────────────────────────────
 * APPLE (iOS):
 *   - apple-touch-icon.png      → 180×180 (iPhone retina)
 *   - apple-touch-icon-167.png  → 167×167 (iPad Pro)
 *   - apple-touch-icon-152.png  → 152×152 (iPad retina)
 *   - apple-touch-icon-120.png  → 120×120 (iPhone older)
 *   - Solid background, NO transparency, NO rounded corners
 *   - Apple HIG: https://developer.apple.com/design/human-interface-guidelines/app-icons
 *
 * ANDROID (Maskable):
 *   - maskable_icon_x192.png    → 192×192
 *   - maskable_icon_x384.png    → 384×384
 *   - maskable_icon_x512.png    → 512×512
 *   - Logo must fit in inner 80% safe zone circle
 *   - Google spec: https://web.dev/articles/maskable-icon
 *
 * ANDROID (Standard):
 *   - android-chrome-192x192.png → 192×192
 *   - android-chrome-512x512.png → 512×512
 *   - Can have transparency, but solid bg recommended
 *
 * FAVICON:
 *   - favicon-32x32.png         → 32×32
 *   - favicon-16x16.png         → 16×16
 *   - icon-96x96.png            → 96×96, transparent, linked for Claude's connector tile
 *   - icon-192x192.png          → 192×192, transparent, upload asset for connector dialogs (not linked)
 *
 * APPLE SPLASH (iOS Home Screen launch, portrait, no alpha):
 *   - apple-splash-1290x2796.png, apple-splash-1179x2556.png, apple-splash-1170x2532.png
 *   - Logo centered on #ffffff; linked from src/pages/_document.tsx
 * ─────────────────────────────────────────────────────────────────
 */

import sharp from 'sharp'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICONS_DIR = path.resolve(__dirname, '../public/icons')

// Read SVG sources
const appleTouchSvg = readFileSync(path.join(ICONS_DIR, 'logo-apple-touch.svg'))
const logoSvg = readFileSync(path.join(ICONS_DIR, 'logo.svg'))
const maskableSvg = readFileSync(path.join(ICONS_DIR, 'logo-maskable.svg'))

// We also generate standard (non-maskable) android icons from the apple-touch SVG
// since it has a solid bg which looks better than transparent on most launchers
const standardSvg = appleTouchSvg

async function generateIcon(svgBuffer, outputName, size, alpha = 1) {
  const outputPath = path.join(ICONS_DIR, outputName)
  await sharp(svgBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha }
    })
    .png({
      quality: 100,
      compressionLevel: 9
    })
    .toFile(outputPath)

  console.log(`  ✅ ${outputName} (${size}×${size})`)
}

// Two passes: sharp runs composite late, so removeAlpha in the same chain would not apply.
async function generateSplash(svgBuffer, width, height) {
  const outputName = `apple-splash-${width}x${height}.png`
  const logo = await sharp(svgBuffer)
    .resize(Math.round(width * 0.4))
    .png()
    .toBuffer()
  const canvas = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer()
  await sharp(canvas)
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(ICONS_DIR, outputName))

  console.log(`  ✅ ${outputName} (${width}×${height})`)
}

async function main() {
  console.log('🎨 Generating PWA icons for Docs.plus\n')

  // ── Apple Touch Icons ──────────────────────────────────
  console.log('📱 Apple Touch Icons (iOS):')
  await generateIcon(appleTouchSvg, 'apple-touch-icon.png', 180)
  await generateIcon(appleTouchSvg, 'apple-touch-icon-167x167.png', 167)
  await generateIcon(appleTouchSvg, 'apple-touch-icon-152x152.png', 152)
  await generateIcon(appleTouchSvg, 'apple-touch-icon-120x120.png', 120)

  // ── Maskable Icons (Android Adaptive) ──────────────────
  console.log('\n🤖 Maskable Icons (Android Adaptive):')
  await generateIcon(maskableSvg, 'maskable_icon_x192.png', 192)
  await generateIcon(maskableSvg, 'maskable_icon_x384.png', 384)
  await generateIcon(maskableSvg, 'maskable_icon_x512.png', 512)

  // ── Standard Android Chrome Icons ─────────────────────
  console.log('\n🌐 Standard Android Chrome Icons:')
  await generateIcon(standardSvg, 'android-chrome-192x192.png', 192)
  await generateIcon(standardSvg, 'android-chrome-512x512.png', 512)

  // ── Favicons ──────────────────────────────────────────
  console.log('\n⭐ Favicons:')
  await generateIcon(appleTouchSvg, 'favicon-32x32.png', 32)
  await generateIcon(appleTouchSvg, 'favicon-16x16.png', 16)
  await generateIcon(logoSvg, 'icon-96x96.png', 96, 0)
  await generateIcon(logoSvg, 'icon-192x192.png', 192, 0)

  console.log('\n🚀 Apple Splash Screens (iOS):')
  await generateSplash(appleTouchSvg, 1290, 2796)
  await generateSplash(appleTouchSvg, 1179, 2556)
  await generateSplash(appleTouchSvg, 1170, 2532)

  console.log('\n✨ All icons generated successfully!')
  console.log('\n📋 Next steps:')
  console.log('   1. Verify icons visually (open the PNGs)')
  console.log('   2. Test on https://maskable.app/editor to verify safe zone')
  console.log('   3. Deploy and re-add to home screen on iOS/Android')
  console.log('   4. Clear browser cache / re-install PWA to see changes')
}

main().catch((err) => {
  console.error('❌ Error generating icons:', err)
  process.exit(1)
})
