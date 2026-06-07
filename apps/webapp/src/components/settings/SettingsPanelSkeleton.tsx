import SettingsCard from './components/SettingsCard'
import { SETTINGS_TABS, SUPPORT_LINKS } from './constants'

const navLabelWidth = (label: string) => Math.max(48, label.length * 8 + 8)

export const ProfileSkeleton = () => (
  <div className="space-y-4">
    <SettingsCard>
      <div className="flex items-center gap-5">
        <div className="skeleton rounded-box size-24 shrink-0" />
        <div className="flex flex-col gap-2">
          <div className="skeleton rounded-field h-5 w-32" />
          <div className="skeleton rounded-field h-4 w-24" />
          <div className="skeleton rounded-field h-8 w-20" />
        </div>
      </div>
    </SettingsCard>
    <SettingsCard>
      <div className="skeleton rounded-field mb-4 h-5 w-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton rounded-field h-11 w-full" />
        <div className="skeleton rounded-field h-11 w-full" />
      </div>
      <div className="skeleton rounded-field mt-4 h-24 w-full" />
    </SettingsCard>
  </div>
)

export const DocumentsSkeleton = () => (
  <div className="space-y-4">
    <SettingsCard>
      <div className="skeleton rounded-field h-11 w-full" />
    </SettingsCard>
    <SettingsCard>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton rounded-field size-5 shrink-0" />
            <div className="skeleton rounded-field h-4 flex-1" />
            <div className="skeleton rounded-field hidden h-4 w-20 sm:block" />
          </div>
        ))}
      </div>
    </SettingsCard>
  </div>
)

export const SecuritySkeleton = () => (
  <div className="space-y-4">
    <SettingsCard>
      <div className="skeleton rounded-field mb-4 h-5 w-32" />
      <div className="skeleton rounded-field mb-3 h-4 w-64" />
      <div className="skeleton rounded-field h-11 w-full" />
    </SettingsCard>
  </div>
)

export const AppearanceSkeleton = () => (
  <div className="space-y-4">
    <SettingsCard>
      <div className="mb-3 flex items-center gap-2">
        <div className="skeleton size-5 rounded" />
        <div className="skeleton rounded-field h-5 w-24" />
      </div>
      <div className="skeleton rounded-field mb-4 h-3 w-64" />
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton rounded-box h-[44px] w-full sm:h-28 sm:flex-1" />
        ))}
      </div>
    </SettingsCard>
  </div>
)

export const NotificationsSkeleton = () => (
  <div className="space-y-4">
    <SettingsCard>
      <div className="skeleton rounded-field mb-4 h-5 w-40" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="flex-1 space-y-1">
            <div className="skeleton rounded-field h-4 w-24" />
            <div className="skeleton rounded-field h-3 w-40" />
          </div>
          <div className="skeleton h-6 w-10 rounded-full" />
        </div>
      ))}
    </SettingsCard>
  </div>
)

const SettingsPanelSkeleton = () => (
  <div className="bg-base-100 flex min-h-0 flex-1 flex-col overflow-hidden md:h-[min(85vh,800px)] md:flex-none md:flex-row">
    <aside className="border-base-300 flex min-h-0 w-full flex-1 flex-col md:w-72 md:flex-none md:shrink-0 md:border-r lg:w-80">
      <div className="border-base-300 flex items-center justify-between border-b p-4 md:hidden">
        <div className="skeleton rounded-field h-5 w-20" />
        <div className="skeleton size-8 rounded-full" />
      </div>

      <div className="flex-1 space-y-4 overflow-hidden p-4 sm:p-6">
        <div className="bg-base-200 rounded-box flex items-center gap-2.5 p-2.5">
          <div className="skeleton ring-base-100 size-8 shrink-0 rounded-full shadow-sm ring-2" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton rounded-field h-4 w-28" />
            <div className="skeleton rounded-field h-3 w-36" />
          </div>
        </div>

        <div className="skeleton rounded-field ml-2 h-3 w-14" />

        <div className="space-y-1">
          {SETTINGS_TABS.map((tab, i) => (
            <div
              key={tab.id}
              className={`rounded-field flex min-h-[44px] items-center gap-2.5 px-3 ${
                i === 0 ? 'bg-primary/10' : ''
              }`}>
              <div className="skeleton size-[18px] shrink-0 rounded" />
              <div
                className="skeleton rounded-field h-4"
                style={{ width: navLabelWidth(tab.label) }}
              />
              <div className="skeleton ml-auto size-[18px] shrink-0 rounded md:hidden" />
            </div>
          ))}
        </div>

        <div className="border-base-300 border-t" />

        <div className="skeleton rounded-field ml-2 h-3 w-20" />

        <div className="space-y-0.5">
          {SUPPORT_LINKS.map((link) => (
            <div
              key={link.label}
              className="rounded-field flex min-h-[44px] items-center gap-2.5 px-2">
              <div className="skeleton size-4 shrink-0 rounded" />
              <div
                className="skeleton rounded-field h-4"
                style={{ width: navLabelWidth(link.label) }}
              />
              <div className="skeleton ml-auto size-3.5 shrink-0 rounded" />
            </div>
          ))}
        </div>

        <div className="skeleton rounded-field h-[44px] w-full" />
      </div>

      <div className="border-base-300 mt-auto shrink-0 border-t p-4 sm:px-6">
        <div className="skeleton rounded-field h-10 w-full" />
      </div>
    </aside>

    <div className="hidden min-h-0 flex-1 flex-col md:flex">
      <div className="border-base-300 flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <div className="skeleton rounded-field h-5 w-16" />
        <div className="skeleton ml-auto size-8 rounded-full" />
      </div>

      {/* Default to the Profile section's shape — covers the common case. */}
      <div className="bg-base-200 flex-1 overflow-hidden">
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <ProfileSkeleton />
        </div>
      </div>
    </div>
  </div>
)

export default SettingsPanelSkeleton
