import { EmptyState } from '@components/ui/EmptyState'
import { ScrollArea } from '@components/ui/ScrollArea'
import { Icons } from '@icons'
import { useAuthStore, useThemeStore } from '@stores'
import { sheetSafeAreaPadMobileClassName } from '@utils/sheetBodyPadding'
import { twMerge } from '@utils/twMerge'
import { useRouter } from 'next/router'
import type { ComponentType, ReactNode } from 'react'
import type { IconType } from 'react-icons'
import {
  LuBell,
  LuCamera,
  LuCheck,
  LuChevronRight,
  LuClock,
  LuExternalLink,
  LuFilePlus,
  LuFileText,
  LuKeyRound,
  LuLink,
  LuMail,
  LuPalette,
  LuPencil,
  LuPlug,
  LuPlus,
  LuShield,
  LuUser
} from 'react-icons/lu'
import { SiModelcontextprotocol } from 'react-icons/si'

import SettingsCard from './components/SettingsCard'
import {
  DOCUMENTS_VIEW_STORAGE_KEY,
  type DocumentViewMode,
  MAX_LINKS,
  SETTINGS_TABS,
  supportRowsFor
} from './constants'
import { ToggleRowSkeleton } from './ToggleRowSkeleton'
import type { LinkItem, TabType } from './types'
import { isMobileSurface } from './utils/isMobileSurface'

const navLabelWidth = (label: string) => Math.max(48, label.length * 8 + 8)

/** A text bone inside a line box of the real line height, so the swap moves no pixel. */
export const TextLine = ({
  box = 'h-5',
  bone,
  className
}: {
  box?: string
  bone: string
  className?: string
}) => (
  <div className={twMerge('flex items-center', box, className)}>
    <div className={`skeleton ${bone}`} />
  </div>
)

/** Mirrors `SettingsCardHeader`. The lead icon is static, so it is drawn, not boned. */
const CardHeaderSkeleton = ({
  icon: Icon,
  titleWidth,
  description = false
}: {
  icon: IconType
  titleWidth: string
  description?: boolean
}) => (
  <div className="mb-3 flex flex-col gap-1">
    <div className="flex h-6 items-center gap-2">
      <Icon size={20} aria-hidden className="text-primary shrink-0" />
      <div className={`skeleton h-4 ${titleWidth}`} />
    </div>
    {description && <TextLine bone="h-3 w-72 max-w-full" />}
  </div>
)

/** A field with its label above: a 20px label line, then the field (40px for an input). */
export const FieldSkeleton = ({
  labelWidth = 'w-16',
  fieldHeight = 'h-10',
  className
}: {
  labelWidth?: string
  fieldHeight?: string
  className?: string
}) => (
  <div className={twMerge('flex flex-col gap-1.5', className)}>
    <TextLine bone={`h-3 ${labelWidth}`} />
    <div className={`skeleton rounded-field w-full ${fieldHeight}`} />
  </div>
)

// Saved links are in the profile already, so the row count is known before the chunk.
const SocialLinksSkeleton = () => {
  const links = useAuthStore((s) => s.profile?.profile_data?.linkTree as LinkItem[] | undefined)
  const count = links?.length ?? 0

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4">
        <FieldSkeleton labelWidth="w-20" className="min-w-0 flex-1" />
        <div className="flex h-10 shrink-0 items-center gap-1.5">
          <LuPlus size={14} aria-hidden className="shrink-0 text-[var(--primary-ink)]" />
          <div className="skeleton h-3 w-14" />
        </div>
      </div>
      {count >= MAX_LINKS && (
        <p className="text-meta flex items-start gap-1.5 font-medium text-[var(--warning-ink)]">
          <Icons.alert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>Maximum of {MAX_LINKS} links reached.</span>
        </p>
      )}
      {links && count > 0 ? (
        <div className="space-y-2">
          <TextLine bone="h-3 w-24" />
          {links.map((link) => (
            <div key={link.url} className="-mx-2 flex items-center gap-3 px-2 py-1.5">
              <div className="skeleton size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <TextLine bone="h-3.5 w-40 max-w-full" />
                {link.metadata?.description && <TextLine bone="h-3 w-56 max-w-full" />}
              </div>
              {/* The remove button's 24px slot; it shows on hover at md. */}
              <div className="size-6 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          layout="inline"
          title="No links added yet."
          body="Add your social profiles above."
        />
      )}
    </div>
  )
}

export const ProfileSkeleton = () => (
  <div className="space-y-4">
    <SettingsCard>
      <div className="flex items-center gap-5">
        <div className="skeleton size-24 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <TextLine box="h-6" bone="h-4 w-32" />
            <TextLine bone="h-3 w-64 max-w-full" />
          </div>
          <div className="flex h-5 items-center gap-1.5">
            <LuCamera size={14} aria-hidden className="shrink-0 text-[var(--primary-ink)]" />
            <div className="skeleton h-3 w-12" />
          </div>
        </div>
      </div>
    </SettingsCard>
    <SettingsCard>
      <CardHeaderSkeleton icon={LuUser} titleWidth="w-44" />
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <TextLine bone="h-3 w-12" />
        {/* 4 rows of 21px, 16px padding and a 1px border: 102px, read from CSS. */}
        <div className="skeleton rounded-field h-25.5 w-full" />
      </div>
    </SettingsCard>
    <SettingsCard>
      <CardHeaderSkeleton icon={LuLink} titleWidth="w-48" description />
      <SocialLinksSkeleton />
    </SettingsCard>
    <div className="h-16" />
    <div
      className={`bg-base-200 border-base-300 sticky bottom-0 -mx-4 border-t px-4 py-4 ${sheetSafeAreaPadMobileClassName} sm:-mx-6 sm:px-6`}>
      <div className="skeleton rounded-field h-10 w-full" />
    </div>
  </div>
)

// The ⋮ trigger is a 44px target below `md` and 36px at `md` (DocumentRowMenu).
const RowMenuSkeleton = () => <div className="skeleton rounded-field size-11 shrink-0 md:size-9" />

export const DocumentsBodySkeleton = ({ viewMode }: { viewMode: DocumentViewMode }) =>
  viewMode === 'grid' ? (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-base-300 bg-base-100 rounded-box flex flex-col border">
          <div className="rounded-t-box flex aspect-[4/3] items-end justify-center overflow-hidden bg-[var(--pad-well)] px-3.5 pt-2.5">
            <div className="border-base-300 bg-base-100 h-full w-full overflow-hidden rounded-t-[2px] border border-b-0 px-3 pt-2.5">
              <div className="skeleton mb-2 h-2.5 w-1/2" />
              <div className="skeleton mb-1.5 h-1.5 w-full" />
              <div className="skeleton h-1.5 w-4/5" />
            </div>
          </div>
          <div className="px-3 pt-3">
            <TextLine bone="h-3.5 w-3/4" />
          </div>
          <div className="px-3 pt-0.5">
            <TextLine bone="h-3 w-1/3" />
          </div>
          <div className="mt-auto flex items-center gap-2 px-3 pt-1 pb-2">
            <div className="ml-auto">
              <RowMenuSkeleton />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="divide-base-300 divide-y">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-1 pr-1">
          <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3">
            <LuFileText size={18} aria-hidden className="text-base-content/60 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <TextLine bone="h-3.5 w-3/4" />
              <TextLine bone="h-3 w-16" className="sm:hidden" />
            </div>
          </div>
          <TextLine bone="h-3 w-20" className="hidden shrink-0 sm:flex" />
          <RowMenuSkeleton />
        </div>
      ))}
    </div>
  )

export const DocumentsSkeleton = () => {
  // Match the persisted view so the loading bones do not flip layout once the section mounts.
  const isGrid =
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(DOCUMENTS_VIEW_STORAGE_KEY) === 'grid'

  return (
    <div className="space-y-4 max-md:flex max-md:min-h-full max-md:flex-col">
      <SettingsCard className="max-md:flex-1 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">
        <div className="space-y-4 max-md:space-y-0">
          <div className="max-md:border-base-300 max-md:bg-base-100 space-y-4 max-md:space-y-2.5 max-md:border-b max-md:px-4 max-md:pt-3 max-md:pb-2.5">
            <div className="skeleton rounded-field h-10 w-full" />

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <div className="skeleton rounded-field h-11 min-w-0 flex-1 sm:h-8 sm:max-w-40" />
                <div className="skeleton rounded-field h-11 min-w-0 flex-1 sm:h-8 sm:max-w-44" />
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <div className="skeleton rounded-field h-11 w-[5.5rem] sm:h-8 sm:w-16" />
              </div>
            </div>
          </div>

          <div className="max-md:px-4 max-md:pt-1">
            <DocumentsBodySkeleton viewMode={isGrid ? 'grid' : 'list'} />
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

// Same provider filter as `SecuritySection`: one row per listed method the session holds.
const SIGN_IN_PROVIDERS = ['google', 'email']

export const SecuritySkeleton = () => {
  const session = useAuthStore((s) => s.session)
  const fromIdentities = session?.identities?.map((identity) => identity.provider) ?? []
  const providers = new Set<string>(
    fromIdentities.length ? fromIdentities : (session?.app_metadata?.providers ?? [])
  )
  const methods = SIGN_IN_PROVIDERS.filter((provider) => providers.has(provider))

  return (
    <div className="space-y-4">
      {session?.email && (
        <SettingsCard>
          <CardHeaderSkeleton icon={LuShield} titleWidth="w-32" />
          <TextLine bone="h-3.5 w-48 max-w-full" />
        </SettingsCard>
      )}
      <SettingsCard>
        <CardHeaderSkeleton icon={LuKeyRound} titleWidth="w-36" />
        {methods.length > 0 && (
          <div className="border-base-300 rounded-box divide-base-300 mb-3 divide-y border">
            {methods.map((provider) => (
              <div key={provider} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="bg-base-200 rounded-field size-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <TextLine bone="h-3.5 w-20" />
                  <TextLine bone="h-3 w-40 max-w-full" className="mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
        <TextLine bone="h-3 w-72 max-w-full" />
      </SettingsCard>
    </div>
  )
}

// The picked theme's frame is known before the chunk, so its ring and check stay real.
const ThemeCardSkeleton = ({ selected }: { selected: boolean }) => (
  <div
    className={`rounded-box relative overflow-hidden border ${
      selected ? 'border-primary ring-primary/30 ring-2' : 'border-base-300'
    }`}>
    {selected && (
      <span className="bg-primary text-primary-content absolute top-1.5 right-1.5 z-10 flex size-4 items-center justify-center rounded-full">
        <LuCheck size={11} strokeWidth={3} aria-hidden />
      </span>
    )}
    <div className="skeleton aspect-[4/3] rounded-none" />
    <div className="border-base-300 flex items-center border-t px-2.5 py-1.5">
      <TextLine bone="h-3 w-12" />
    </div>
  </div>
)

// Same order as the picker: three light themes, then four dark ones.
const THEME_GROUPS = [
  ['light', 'graphite-light', 'paper-light'],
  ['dark', 'graphite-dark', 'paper-dark', 'dark-hc']
] as const

export const AppearanceSkeleton = () => {
  const preference = useThemeStore((s) => s.preference)
  const systemSelected = preference === 'system'

  return (
    <div className="space-y-4">
      <SettingsCard>
        <CardHeaderSkeleton icon={LuPalette} titleWidth="w-14" description />
        <div
          className={`rounded-box flex w-full items-center gap-3 border px-3 py-2.5 ${
            systemSelected
              ? 'border-primary bg-primary/10 ring-primary/30 ring-2'
              : 'border-base-300'
          }`}>
          <span className="border-base-300 rounded-field flex h-6 w-9 shrink-0 overflow-hidden border">
            <span data-theme="docsplus" className="bg-base-100 flex-1" />
            <span data-theme="docsplus-dark" className="bg-base-100 flex-1" />
          </span>
          <div className="min-w-0 flex-1">
            <TextLine bone="h-3.5 w-16" />
            <TextLine bone="h-3 w-56 max-w-full" />
          </div>
          {systemSelected && (
            <span className="bg-primary text-primary-content flex size-5 shrink-0 items-center justify-center rounded-full">
              <LuCheck size={12} strokeWidth={3} aria-hidden />
            </span>
          )}
        </div>
        {THEME_GROUPS.map((group) => (
          <div key={group[0]}>
            <TextLine bone="h-3 w-10" className="mt-4 mb-2" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {group.map((value) => (
                <ThemeCardSkeleton key={value} selected={preference === value} />
              ))}
            </div>
          </div>
        ))}
      </SettingsCard>
    </div>
  )
}

// The four real cards are Push, Time zone, Quiet hours and Email. Quiet hours and email start off.
// On iOS Safari the Push card holds a notice, not toggles; the section passes it in.
export const NotificationsSkeleton = ({ pushNotice }: { pushNotice?: ReactNode }) => (
  <div className="space-y-4">
    <SettingsCard>
      <CardHeaderSkeleton icon={LuBell} titleWidth="w-40" />
      {pushNotice ?? (
        <div className="divide-base-300 divide-y">
          {[0, 1, 2, 3].map((i) => (
            <ToggleRowSkeleton key={i} />
          ))}
        </div>
      )}
    </SettingsCard>
    <SettingsCard>
      <div className="flex max-w-xs flex-col gap-1.5">
        <TextLine bone="h-3 w-16" />
        <div className="skeleton rounded-field h-10 w-full" />
        <TextLine bone="h-3 w-64 max-w-full" />
      </div>
    </SettingsCard>
    <SettingsCard>
      <CardHeaderSkeleton icon={LuClock} titleWidth="w-24" />
      <div className="divide-base-300 divide-y">
        <ToggleRowSkeleton />
      </div>
    </SettingsCard>
    <SettingsCard>
      <CardHeaderSkeleton icon={LuMail} titleWidth="w-40" />
      <div className="divide-base-300 divide-y">
        <ToggleRowSkeleton />
      </div>
    </SettingsCard>
  </div>
)

// Bone widths sit near the real labels, so the badges wrap the same way.
const MCP_ABILITIES: { icon: IconType; width: string }[] = [
  { icon: Icons.search, width: 'w-32' },
  { icon: LuFilePlus, width: 'w-18' },
  { icon: LuPencil, width: 'w-36' }
]

// The Apps with access card renders nothing while its list loads, so it has no bones here.
export const ConnectedAppsSkeleton = () => {
  const isPhone = typeof window !== 'undefined' && isMobileSurface()

  return (
    <div className="space-y-4">
      <SettingsCard>
        <div className="mb-3 flex h-6 items-center gap-2">
          <SiModelcontextprotocol size={20} aria-hidden className="text-primary shrink-0" />
          <div className="skeleton h-4 w-24" />
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="status" />
            <span className="skeleton h-3 w-14" />
          </span>
          <div className="ms-auto flex items-center gap-1.5">
            <div className="skeleton h-3 w-20" />
            <LuExternalLink size={14} aria-hidden className="text-[var(--primary-ink)]" />
          </div>
        </div>
        <TextLine bone="h-3.5 w-full max-w-md" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {MCP_ABILITIES.map(({ icon: Icon, width }) => (
            <span key={width} className="badge badge-soft badge-sm gap-1.5">
              <Icon size={12} aria-hidden className="text-base-content/70 shrink-0" />
              <span className={`skeleton h-3 ${width}`} />
            </span>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard>
        <CardHeaderSkeleton icon={LuPlug} titleWidth="w-28" description={isPhone} />
        {isPhone ? (
          <div>
            <TextLine bone="h-3 w-28" />
            <div className="mt-2 flex items-center gap-2">
              <div className="bg-base-200 border-base-300 rounded-field min-w-0 flex-1 border px-2 py-1.5">
                <TextLine box="h-4" bone="h-3 w-48 max-w-full" />
              </div>
              <div className="skeleton rounded-field h-8 w-20 shrink-0" />
            </div>
          </div>
        ) : (
          <>
            {/* The `PanelTabBar p-0` track. `PanelTabBarSkeleton` has a fixed inset, and its module
                pulls the chat services into this eager file. A bone would not show on the
                base-300 track, so the first pill is the static base-100 fill. */}
            <div className="bg-base-300 rounded-box flex p-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={
                    i === 0
                      ? 'bg-base-100 rounded-field min-h-9 flex-1 shadow-sm'
                      : 'min-h-9 flex-1'
                  }
                />
              ))}
            </div>
            <div className="mt-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <TextLine bone="h-3.5 w-40" />
                <div className="skeleton rounded-field h-8 w-32" />
              </div>
              <ol className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex gap-3">
                    <span className="bg-base-200 text-base-content/70 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {n}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <TextLine bone={n === 2 ? 'h-3.5 w-2/3' : 'h-3.5 w-full'} />
                      {/* Step 2 of the Claude tab fits on one line at every width. */}
                      {n !== 2 && <TextLine bone="h-3.5 w-2/3" />}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </SettingsCard>
    </div>
  )
}

const SECTION_SKELETONS: Record<TabType, ComponentType> = {
  profile: ProfileSkeleton,
  documents: DocumentsSkeleton,
  appearance: AppearanceSkeleton,
  security: SecuritySkeleton,
  notifications: NotificationsSkeleton,
  'connected-apps': ConnectedAppsSkeleton
}

/** Mirrors `SettingsPanel` on the tab that will load. A named tab opens the pane on a phone. */
const SettingsPanelSkeleton = ({ defaultTab }: { defaultTab?: TabType }) => {
  const supportRows = supportRowsFor(useRouter().pathname)
  const activeTab = defaultTab ?? 'profile'
  const showContent = defaultTab !== undefined
  const activeConfig = SETTINGS_TABS.find((tab) => tab.id === activeTab)
  const activeLabel = activeConfig?.label ?? ''
  const Section = SECTION_SKELETONS[activeTab]

  return (
    <div
      className="bg-base-100 relative flex min-h-0 flex-1 flex-col overflow-clip md:h-[min(85vh,800px)] md:flex-none md:flex-row"
      aria-hidden>
      <aside
        className={`border-base-300 flex min-h-0 w-full flex-1 flex-col md:w-72 md:flex-none md:shrink-0 md:border-r lg:w-80 ${
          showContent ? 'max-md:hidden' : ''
        }`}>
        <div className="border-base-300 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-1.5 md:hidden">
          <TextLine box="h-7" bone="h-5 w-24" />
          <div className="skeleton rounded-field size-11" />
        </div>

        <ScrollArea className="min-h-0 flex-1 overscroll-contain p-4 sm:p-6" scrollbarSize="thin">
          <div className="bg-base-200 rounded-box mb-4 flex items-center gap-2.5 p-2.5">
            <div className="skeleton ring-base-100 size-8 shrink-0 rounded-full shadow-sm ring-2" />
            <div className="min-w-0 flex-1">
              <TextLine bone="h-3.5 w-28" />
              <TextLine bone="h-3 w-36" />
            </div>
          </div>

          <div className="mb-4">
            <TextLine bone="h-3 w-14" className="mb-1.5 px-2 max-md:hidden" />
            <div className="flex flex-col gap-0.5">
              {SETTINGS_TABS.map(({ id, label, icon: Icon }) => {
                const isActive = id === activeTab
                return (
                  <div
                    key={id}
                    className={`rounded-field flex min-h-[44px] items-center justify-between px-4 ${
                      isActive ? 'bg-primary text-primary-content' : 'text-base-content'
                    }`}>
                    <span className="flex items-center gap-2.5">
                      <Icon size={18} aria-hidden />
                      <span className="skeleton h-3.5" style={{ width: navLabelWidth(label) }} />
                    </span>
                    <LuChevronRight
                      size={18}
                      aria-hidden
                      className={`md:hidden ${isActive ? 'text-primary-content/70' : 'text-base-content/50'}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-base-300 my-3 border-t" />

          <div className="mb-4">
            <TextLine bone="h-3 w-20" className="mb-1.5 px-2" />
            <div className="space-y-0.5">
              {supportRows.map(({ label, icon: Icon, kind }) => (
                <div
                  key={label}
                  className="text-base-content/70 rounded-field flex min-h-[44px] items-center gap-2.5 px-2 py-1.5">
                  <Icon size={16} aria-hidden className="shrink-0" />
                  <span className="skeleton h-3.5" style={{ width: navLabelWidth(label) }} />
                  {kind === 'link' && (
                    <LuExternalLink size={14} aria-hidden className="ml-auto shrink-0 opacity-40" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div
          className={`border-base-300 mt-auto shrink-0 border-t p-4 ${sheetSafeAreaPadMobileClassName} sm:px-6`}>
          <div className="skeleton rounded-field h-10 w-full" />
        </div>
      </aside>

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${showContent ? '' : 'max-md:hidden'}`}>
        <div className="border-base-300 flex shrink-0 items-center gap-2 border-b px-4 py-3 max-md:py-1.5">
          <div className="skeleton rounded-field size-11 md:hidden" />
          <div className="flex h-7 flex-1 items-center">
            <div className="skeleton h-5" style={{ width: activeLabel.length * 11 + 8 }} />
          </div>
          <div className="skeleton rounded-field size-11 md:hidden" />
          <div className="skeleton rounded-field size-8 max-md:hidden" />
        </div>

        <ScrollArea
          className={`bg-base-200 min-h-0 flex-1 overscroll-contain ${
            activeConfig?.fullWidth ? 'max-md:bg-base-100' : ''
          }`}
          scrollbarSize="thin">
          <div
            className={twMerge(
              'mx-auto p-4 sm:p-6',
              activeConfig?.fullWidth
                ? 'w-full max-w-none max-md:flex max-md:min-h-full max-md:flex-col max-md:p-0'
                : 'max-w-2xl',
              sheetSafeAreaPadMobileClassName
            )}>
            <Section />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default SettingsPanelSkeleton
