import { type ThemePreference, useThemeStore } from '@stores'
import { LuContrast, LuMonitor, LuMoon, LuPalette, LuSun } from 'react-icons/lu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThemeOptionProps {
  value: ThemePreference
  label: string
  icon: typeof LuSun
  description: string
  selected: boolean
  onSelect: (value: ThemePreference) => void
}

// ---------------------------------------------------------------------------
// Theme option card
// ---------------------------------------------------------------------------

const ThemeOption = ({
  value,
  label,
  icon: Icon,
  description,
  selected,
  onSelect
}: ThemeOptionProps) => {
  const base = selected
    ? 'border-primary bg-primary/10 ring-primary/30 ring-2'
    : 'border-base-300 bg-base-100 hover:bg-base-200'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={`rounded-box cursor-pointer border transition-colors ${base} flex min-h-[44px] items-center gap-3 p-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:p-4`}>
      <Icon
        size={20}
        className={`shrink-0 sm:size-6 ${selected ? 'text-primary' : 'text-base-content/60'}`}
      />
      <div className="min-w-0 text-left sm:text-center">
        <span
          className={`block text-sm font-medium ${
            selected ? 'text-primary' : 'text-base-content'
          }`}>
          {label}
        </span>
        <span className="text-base-content/50 block text-xs">{description}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Options config
// ---------------------------------------------------------------------------

const THEME_OPTIONS: {
  value: ThemePreference
  label: string
  icon: typeof LuSun
  description: string
}[] = [
  {
    value: 'light',
    label: 'Light',
    icon: LuSun,
    description: 'Always use light theme'
  },
  {
    value: 'system',
    label: 'System',
    icon: LuMonitor,
    description: 'Follow your OS setting'
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: LuMoon,
    description: 'Always use dark theme'
  },
  {
    value: 'dark-hc',
    label: 'Dark HC',
    icon: LuContrast,
    description: 'High contrast for projectors'
  }
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const AppearanceSection = () => {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <div className="space-y-4">
      <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <LuPalette size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Theme</h2>
        </div>
        <p className="text-base-content/60 text-xs">
          Choose how docs.plus looks to you. Select a single theme, or sync with your system
          setting.
        </p>

        {/* Four-state selector — vertical stack on mobile, horizontal cards on sm+ */}
        <div
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3"
          role="radiogroup"
          aria-label="Theme preference">
          {THEME_OPTIONS.map((option) => (
            <ThemeOption
              key={option.value}
              value={option.value}
              label={option.label}
              icon={option.icon}
              description={option.description}
              selected={preference === option.value}
              onSelect={setPreference}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

export default AppearanceSection
