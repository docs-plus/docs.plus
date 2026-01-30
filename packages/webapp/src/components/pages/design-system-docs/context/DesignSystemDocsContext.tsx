/**
 * Design System Documentation Context
 * ====================================
 * State management for the documentation page.
 */

import { copyToClipboard as copyToClipboardUtil } from '@utils/clipboard'
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef,useState } from 'react'

import { NAV_SECTIONS } from '../constants'
import type { SearchResult } from '../types'

interface ContextValue {
  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SearchResult[]

  // Navigation
  activeSection: string
  setActiveSection: (id: string) => void

  // Mobile sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Copy to clipboard (inline feedback only, no toast for docs)
  copyToClipboard: (text: string) => Promise<boolean>
  copiedText: string | null
}

const Context = createContext<ContextValue | null>(null)

interface ProviderProps {
  children: ReactNode
}

export const DesignSystemDocsProvider = ({ children }: ProviderProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('introduction')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Search functionality
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    const results: SearchResult[] = []

    NAV_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        if (item.label.toLowerCase().includes(query)) {
          results.push({
            type: 'section',
            id: item.id,
            title: item.label,
            section: section.title
          })
        }
      })
    })

    return results.slice(0, 10)
  }, [searchQuery])

  // Use the shared clipboard utility
  const copyToClipboard = useCallback(async (text: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const success = await copyToClipboardUtil(text)

    if (success) {
      setCopiedText(text)
      timeoutRef.current = setTimeout(() => setCopiedText(null), 2000)
    }

    return success
  }, [])

  const value: ContextValue = {
    searchQuery,
    setSearchQuery,
    searchResults,
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen,
    copyToClipboard,
    copiedText
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useDesignSystemDocs = (): ContextValue => {
  const context = useContext(Context)
  if (!context) {
    throw new Error('useDesignSystemDocs must be used within DesignSystemDocsProvider')
  }
  return context
}
