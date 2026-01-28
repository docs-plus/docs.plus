/**
 * Design System Page - Type Definitions
 * ======================================
 * Centralized type definitions for the design system demo page.
 */

export type TabType = 'dashboard' | 'documents' | 'team' | 'components' | 'forms' | 'settings'

export type ThemeType = 'docsplus' | 'docsplus-dark'

export type UserStatus = 'online' | 'away' | 'offline'

export type UserRole = 'Admin' | 'Editor' | 'Viewer'

export type DocumentStatus = 'Published' | 'Draft' | 'Review'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
}

export interface DemoDocument {
  id: number
  name: string
  status: DocumentStatus
  modified: string
  views: number
}

export interface DemoMessage {
  id: number
  user: string
  userId: string
  message: string
  time: string
  isMe: boolean
}

export interface NavItem {
  id: TabType
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge: string | null
}

export interface KeyboardShortcut {
  label: string
  keys: string[]
}

export interface FolderItem {
  name: string
  files: number
  open: boolean
  items: string[] | null
}

export interface PlanOption {
  id: string
  name: string
  desc: string
  price: string
}
