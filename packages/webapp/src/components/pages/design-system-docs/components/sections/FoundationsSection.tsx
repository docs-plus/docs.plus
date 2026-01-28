/**
 * Foundations Section
 * ===================
 * Colors, typography, spacing, radius, shadow, motion, z-index.
 */

import { useState } from 'react'
import {
  MdPalette,
  MdTextFields,
  MdSpaceBar,
  MdRoundedCorner,
  MdLayers,
  MdSpeed
} from 'react-icons/md'
import { SectionHeader, ColorSwatch, CopyButton } from '../shared'
import {
  LIGHT_THEME_COLORS,
  DARK_THEME_COLORS,
  SPACING_SCALE,
  RADIUS_SCALE,
  SHADOW_SCALE,
  Z_INDEX_SCALE,
  TIMING_SCALE
} from '../../constants'

export const FoundationsSection = () => {
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>('light')

  return (
    <div className="space-y-16">
      {/* Colors */}
      <section id="colors">
        <SectionHeader
          id="colors-header"
          title="Colors"
          description="Semantic color tokens that adapt to light and dark themes"
          icon={MdPalette}
        />

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTheme('light')}
            className={`btn btn-sm ${activeTheme === 'light' ? 'btn-primary' : 'btn-ghost'}`}>
            Light Theme
          </button>
          <button
            onClick={() => setActiveTheme('dark')}
            className={`btn btn-sm ${activeTheme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}>
            Dark Theme
          </button>
        </div>

        <div
          data-theme={activeTheme === 'light' ? 'docsplus' : 'docsplus-dark'}
          className="bg-base-100 rounded-xl border border-slate-200 p-6 transition-colors duration-300">
          <div className="grid gap-3 sm:grid-cols-2">
            {(activeTheme === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS).map((color) => (
              <ColorSwatch key={color.name} {...color} />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-blue-50 p-4">
          <h4 className="mb-2 font-semibold text-blue-800">💡 Usage Tips</h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>
              • Use <code className="rounded bg-blue-100 px-1">bg-base-100</code> for page
              backgrounds (theme-aware)
            </li>
            <li>
              • Use <code className="rounded bg-blue-100 px-1">text-base-content</code> for primary
              text
            </li>
            <li>
              • Use <code className="rounded bg-blue-100 px-1">bg-primary</code> for CTAs and brand
              actions
            </li>
            <li>
              • Never use hardcoded colors like{' '}
              <code className="rounded bg-blue-100 px-1">text-gray-800</code> on theme-aware
              backgrounds
            </li>
          </ul>
        </div>
      </section>

      {/* Typography */}
      <section id="typography">
        <SectionHeader
          id="typography-header"
          title="Typography"
          description="Font families, sizes, and weights"
          icon={MdTextFields}
        />

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Heading Scale</span>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-4xl</code>
                <span className="text-4xl font-bold text-slate-800">Page Title</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-2xl</code>
                <span className="text-2xl font-bold text-slate-800">Section Heading</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-xl</code>
                <span className="text-xl font-semibold text-slate-700">Subsection</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-lg</code>
                <span className="text-lg font-semibold text-slate-700">Card Title</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-base</code>
                <span className="text-base text-slate-600">Body text for primary content.</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-sm</code>
                <span className="text-sm text-slate-500">Secondary body text.</span>
              </div>
              <div className="flex items-baseline gap-4">
                <code className="w-24 shrink-0 text-xs text-slate-500">text-xs</code>
                <span className="text-xs text-slate-400">Helper text and captions.</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-800">Font Weights</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Bold (700)</span>
                  <code className="text-slate-500">font-bold</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Semibold (600)</span>
                  <code className="text-slate-500">font-semibold</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Medium (500)</span>
                  <code className="text-slate-500">font-medium</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-normal text-slate-700">Regular (400)</span>
                  <code className="text-slate-500">font-normal</code>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-800">Font Stack</h4>
              <p className="text-sm text-slate-600">
                Uses system fonts via Tailwind defaults. No custom fonts needed.
              </p>
              <code className="mt-2 block rounded bg-slate-100 p-2 text-xs text-slate-600">
                Helvetica, Arial, sans-serif
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Spacing */}
      <section id="spacing">
        <SectionHeader
          id="spacing-header"
          title="Spacing & Layout"
          description="Consistent spacing scale and layout patterns"
          icon={MdSpaceBar}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Token</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Value</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Pixels</th>
                <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">
                  Preview
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SPACING_SCALE.map((token) => (
                <tr key={token.name}>
                  <td className="px-4 py-3 font-mono text-slate-800">{token.name}</td>
                  <td className="px-4 py-3 text-slate-600">{token.value}</td>
                  <td className="px-4 py-3 text-slate-600">{token.pixels}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="bg-primary h-4 rounded" style={{ width: token.pixels }} />
                  </td>
                  <td className="px-4 py-3">
                    <CopyButton text={`p-${token.name}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Radius & Shadow */}
      <section id="radius-shadow">
        <SectionHeader
          id="radius-shadow-header"
          title="Radius & Shadow"
          description="Border radius and shadow scales"
          icon={MdRoundedCorner}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Radius */}
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-4 font-semibold text-slate-800">Border Radius</h4>
            <div className="grid grid-cols-4 gap-3">
              {RADIUS_SCALE.map((r) => (
                <div key={r.name} className="text-center">
                  <div
                    className="border-primary bg-primary/10 mx-auto mb-2 size-12 border-2"
                    style={{ borderRadius: r.value }}
                  />
                  <code className="text-xs text-slate-600">rounded-{r.name}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Shadow */}
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-4 font-semibold text-slate-800">Box Shadow</h4>
            <div className="space-y-3">
              {SHADOW_SCALE.map((s) => (
                <div key={s.name} className="flex items-center gap-4">
                  <div className={`size-12 rounded-lg bg-white ${s.class}`} />
                  <div>
                    <code className="text-sm text-slate-800">{s.class}</code>
                    <p className="text-xs text-slate-500">{s.usage}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Z-Index */}
      <section id="z-index">
        <SectionHeader
          id="z-index-header"
          title="Z-Index Scale"
          description="Consistent layering for overlays, modals, and tooltips"
          icon={MdLayers}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Layer</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Class</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Value</th>
                <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">
                  Usage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Z_INDEX_SCALE.map((z) => (
                <tr key={z.name}>
                  <td className="px-4 py-3 font-medium text-slate-800">{z.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {z.class}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{z.value}</td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{z.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Motion */}
      <section id="motion">
        <SectionHeader
          id="motion-header"
          title="Motion"
          description="Animation timing and easing"
          icon={MdSpeed}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Class</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Duration</th>
                <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">
                  Usage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TIMING_SCALE.map((t) => (
                <tr key={t.name}>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {t.class}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.value}</td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{t.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl bg-amber-50 p-4">
          <h4 className="mb-2 font-semibold text-amber-800">⚠️ Animation Performance</h4>
          <ul className="space-y-1 text-sm text-amber-700">
            <li>
              • Never use <code className="rounded bg-amber-100 px-1">animate-pulse</code> on static
              content
            </li>
            <li>• Loading spinners must have a loading state guard</li>
            <li>• Animations should stop when not visible (use state)</li>
            <li>• CPU should stay near 0% when page is idle</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
