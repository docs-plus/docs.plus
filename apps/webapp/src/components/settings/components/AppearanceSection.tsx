import { PREFERENCE_TO_THEME, type ThemePreference, useThemeStore } from '@stores'
import { useRef } from 'react'
import { LuCheck, LuPalette } from 'react-icons/lu'

import SettingsCard from './SettingsCard'

/** Picker entries are the explicit (non-`system`) preferences; `system` is a separate row. */
type PickerTheme = Exclude<ThemePreference, 'system'>

type ThemeChoice = {
  value: PickerTheme
  label: string
  premium?: boolean
}

const LIGHT_THEMES: ThemeChoice[] = [
  { value: 'light', label: 'Light' },
  { value: 'graphite-light', label: 'Graphite', premium: true },
  { value: 'paper-light', label: 'Paper', premium: true }
]

const DARK_THEMES: ThemeChoice[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'graphite-dark', label: 'Graphite', premium: true },
  { value: 'paper-dark', label: 'Paper', premium: true },
  { value: 'dark-hc', label: 'High Contrast' }
]

// Flat traversal order for roving-tabindex arrow-key navigation (matches DOM order).
const NAV_ORDER: ThemePreference[] = [
  'system',
  ...LIGHT_THEMES.map((c) => c.value),
  ...DARK_THEMES.map((c) => c.value)
]

/** A tiny live copy of the real editor surface — well floor + floated sheet + accent.
    `data-theme` alone drives it: daisyUI sets color-scheme per theme, so the `light-dark()`
    tokens (--pad-well etc.) resolve correctly even in an isolated swatch. */
const ThemePreview = ({ value }: { value: PickerTheme }) => (
  <span
    data-theme={PREFERENCE_TO_THEME[value]}
    className="block aspect-[4/3] rounded-t-[inherit] bg-[var(--pad-well)] p-2">
    <span className="border-base-300 bg-base-100 block h-full overflow-hidden rounded-[5px] border p-1.5">
      <span className="mb-1.5 flex gap-1">
        <span className="bg-base-300 size-1 rounded-full" />
        <span className="bg-base-300 size-1 rounded-full" />
        <span className="bg-base-300 size-1 rounded-full" />
      </span>
      <span className="bg-base-content/30 mb-1 block h-[3px] w-4/5 rounded" />
      <span className="bg-base-content/30 mb-1.5 block h-[3px] w-1/2 rounded" />
      <span className="bg-primary block h-[5px] w-6 rounded" />
    </span>
  </span>
)

type KeyHandler = (e: React.KeyboardEvent, value: ThemePreference) => void
type CardProps = ThemeChoice & {
  group: string
  selected: boolean
  onSelect: () => void
  onKeyDown: KeyHandler
}

const ThemeCard = ({ value, label, group, premium, selected, onSelect, onKeyDown }: CardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    // Two "Graphite"/"Paper" radios exist (light + dark) — the group disambiguates them for SR.
    aria-label={`${label}, ${group}`}
    tabIndex={selected ? 0 : -1}
    onClick={onSelect}
    onKeyDown={(e) => onKeyDown(e, value)}
    data-theme-radio={value}
    className={`rounded-box relative cursor-pointer overflow-hidden border text-left transition-colors focus-visible:outline-none ${
      selected
        ? 'border-primary ring-primary/30 ring-2'
        : 'border-base-300 hover:border-base-content/25'
    }`}>
    {selected && (
      <span className="bg-primary text-primary-content absolute top-1.5 right-1.5 z-10 flex size-4 items-center justify-center rounded-full">
        <LuCheck size={11} strokeWidth={3} aria-hidden />
      </span>
    )}
    <ThemePreview value={value} />
    <span className="border-base-300 flex items-center justify-between gap-1 border-t px-2.5 py-1.5">
      <span className={`text-xs font-medium ${selected ? 'text-primary' : 'text-base-content'}`}>
        {label}
      </span>
      {premium && (
        <span className="text-primary bg-primary/10 rounded px-1.5 py-px text-[9px] font-bold tracking-wide uppercase">
          New
        </span>
      )}
    </span>
  </button>
)

const AppearanceSection = () => {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  const groupRef = useRef<HTMLDivElement>(null)

  // Roving tabindex: arrows move selection + focus through the flat order.
  const handleKeyDown: KeyHandler = (e, value) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight'
    const i = NAV_ORDER.indexOf(value)
    const next = NAV_ORDER[(i + (forward ? 1 : NAV_ORDER.length - 1)) % NAV_ORDER.length]
    setPreference(next)
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-theme-radio="${next}"]`)?.focus()
  }

  const systemSelected = preference === 'system'

  return (
    <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
      <SettingsCard>
        <div className="mb-3 flex items-center gap-2">
          <LuPalette size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Theme</h2>
        </div>
        <p className="text-base-content/60 text-xs">
          Choose how docs.plus looks, or match your device.
        </p>

        <div ref={groupRef} role="radiogroup" aria-label="Theme" className="mt-4">
          {/* System — a policy, not a palette, so it reads as a full-width row. */}
          <button
            type="button"
            role="radio"
            aria-checked={systemSelected}
            aria-label="System"
            tabIndex={systemSelected ? 0 : -1}
            onClick={() => setPreference('system')}
            onKeyDown={(e) => handleKeyDown(e, 'system')}
            data-theme-radio="system"
            className={`rounded-box flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors focus-visible:outline-none ${
              systemSelected
                ? 'border-primary bg-primary/10 ring-primary/30 ring-2'
                : 'border-base-300 hover:bg-base-200'
            }`}>
            <span className="border-base-300 flex h-6 w-9 shrink-0 overflow-hidden rounded-md border">
              <span data-theme="docsplus" className="bg-base-100 flex-1" />
              <span data-theme="docsplus-dark" className="bg-base-100 flex-1" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm font-medium ${systemSelected ? 'text-primary' : 'text-base-content'}`}>
                System
              </span>
              <span className="text-base-content/55 block text-xs">
                Matches your device&apos;s light or dark setting
              </span>
            </span>
            {systemSelected && (
              <span className="bg-primary text-primary-content flex size-5 shrink-0 items-center justify-center rounded-full">
                <LuCheck size={12} strokeWidth={3} aria-hidden />
              </span>
            )}
          </button>

          {(
            [
              ['Light', LIGHT_THEMES],
              ['Dark', DARK_THEMES]
            ] as const
          ).map(([group, choices]) => (
            <div key={group}>
              <p className="text-base-content/45 mt-4 mb-2 text-[10px] font-bold tracking-wider uppercase">
                {group}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {choices.map((choice) => (
                  <ThemeCard
                    key={choice.value}
                    {...choice}
                    group={group}
                    selected={preference === choice.value}
                    onSelect={() => setPreference(choice.value)}
                    onKeyDown={handleKeyDown}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  )
}

export default AppearanceSection
