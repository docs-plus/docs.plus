import { twMerge } from 'tailwind-merge'

export type PanelTabOption<T extends string = string> = {
  label: T
  count?: number
}

type PanelTabBarProps<T extends string> = {
  tabs: readonly PanelTabOption<T>[]
  activeTab: T
  onSelect: (tab: T) => void
  capitalize?: boolean
}

export function PanelTabBar<T extends string>({
  tabs,
  activeTab,
  onSelect,
  capitalize = false
}: PanelTabBarProps<T>) {
  return (
    <div className="border-base-300 flex shrink-0 gap-1 overflow-x-auto border-b px-4 py-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.label

        return (
          <button
            key={tab.label}
            type="button"
            onClick={() => onSelect(tab.label)}
            className={twMerge(
              'rounded-selector px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              capitalize && 'capitalize',
              isActive
                ? 'bg-primary text-primary-content'
                : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
            )}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={twMerge(
                  'ml-1.5',
                  isActive ? 'text-primary-content/80' : 'text-base-content/50'
                )}>
                ({tab.count})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
