/**
 * ColorSwatch Component
 * =====================
 * Displays a color token with swatch, name, value, and copy button.
 */

import { CopyButton } from './CopyButton'

interface ColorSwatchProps {
  name: string
  cssVar: string
  value: string
  usage: string
}

export const ColorSwatch = ({ name, cssVar, value, usage }: ColorSwatchProps) => {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-all hover:border-slate-200 hover:shadow-sm">
      {/* Color swatch */}
      <div
        className="size-12 shrink-0 rounded-lg border border-slate-200 shadow-inner"
        style={{ backgroundColor: `var(${cssVar})` }}
      />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800">{name}</span>
          <CopyButton text={value} label={value} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
            {cssVar}
          </code>
        </div>
        <p className="mt-1 text-xs text-slate-500">{usage}</p>
      </div>
    </div>
  )
}
