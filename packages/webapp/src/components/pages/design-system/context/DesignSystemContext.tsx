/**
 * Design System Page - Context
 * =============================
 * Centralized state management for the design system demo page.
 */

import { createContext, ReactNode, useCallback, useContext, useState } from 'react'

import type { TabType, ThemeType } from '../types'

interface DesignSystemContextValue {
  // Theme
  theme: ThemeType
  toggleTheme: () => void

  // Navigation
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  isTransitioning: boolean

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  // UI State
  showPassword: boolean
  setShowPassword: (show: boolean) => void
  showNotifications: boolean
  setShowNotifications: (show: boolean) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  selectedRows: number[]
  setSelectedRows: (rows: number[]) => void
  chatMessage: string
  setChatMessage: (message: string) => void
}

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null)

interface DesignSystemProviderProps {
  children: ReactNode
}

export const DesignSystemProvider = ({ children }: DesignSystemProviderProps) => {
  // Theme state
  const [theme, setTheme] = useState<ThemeType>('docsplus')

  // Navigation state
  const [activeTab, setActiveTabState] = useState<TabType>('dashboard')
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [chatMessage, setChatMessage] = useState('')

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'docsplus' ? 'docsplus-dark' : 'docsplus'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [theme])

  // Smooth tab transitions
  const setActiveTab = useCallback(
    (tabId: TabType) => {
      if (tabId === activeTab) return
      setIsTransitioning(true)
      setTimeout(() => {
        setActiveTabState(tabId)
        setMobileMenuOpen(false)
        setTimeout(() => setIsTransitioning(false), 50)
      }, 150)
    },
    [activeTab]
  )

  const value: DesignSystemContextValue = {
    theme,
    toggleTheme,
    activeTab,
    setActiveTab,
    isTransitioning,
    sidebarOpen,
    setSidebarOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    showPassword,
    setShowPassword,
    showNotifications,
    setShowNotifications,
    currentPage,
    setCurrentPage,
    selectedRows,
    setSelectedRows,
    chatMessage,
    setChatMessage
  }

  return <DesignSystemContext.Provider value={value}>{children}</DesignSystemContext.Provider>
}

export const useDesignSystem = (): DesignSystemContextValue => {
  const context = useContext(DesignSystemContext)
  if (!context) {
    throw new Error('useDesignSystem must be used within a DesignSystemProvider')
  }
  return context
}
