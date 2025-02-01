import { ReactNode } from 'react'

interface TabProps {
  label: string
  count?: number
  isActive?: boolean
  onClick?: () => void
}

export const Tab = ({ label, count, isActive, onClick }: TabProps) => {
  return (
    <a
      role="tab"
      className={`tab flex flex-nowrap items-center gap-2 text-nowrap ${isActive ? 'bg-white shadow' : ''}`}
      onClick={onClick}>
      <span className={`mt-0.5 font-semibold ${isActive ? 'text-indigo-600' : ''}`}>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-md bg-base-200 px-1 text-xs font-extrabold leading-5 ${
            isActive ? 'text-indigo-600' : 'bg-base-300'
          }`}>
          {count}
        </span>
      )}
    </a>
  )
}

interface TabListProps {
  tabs: Array<{ label: string; count: number }>
  activeTab: string
  onTabChange: (tab: string) => void
  className?: string
}

export const TabList = ({ tabs, activeTab, onTabChange, className }: TabListProps) => {
  return (
    <div role="tablist" className={`tabs-boxed tabs ${className}`}>
      {tabs.map((tab) => (
        <Tab
          key={tab.label}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.label}
          onClick={() => onTabChange(tab.label)}
        />
      ))}
    </div>
  )
}

interface TabContentProps {
  activeTab: string
  tabId: string
  children: ReactNode
  className?: string
}

export const TabContent = ({ activeTab, tabId, children, className }: TabContentProps) => {
  return (
    <div
      role="tabpanel"
      className={`tab-content ${activeTab === tabId ? 'block' : 'hidden'} ${className}`}
      aria-hidden={activeTab !== tabId}>
      {children}
    </div>
  )
}
