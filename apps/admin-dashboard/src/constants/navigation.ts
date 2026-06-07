import type { IconType } from 'react-icons'
import {
  LuActivity,
  LuBell,
  LuFileText,
  LuGhost,
  LuLayoutDashboard,
  LuMessageSquare,
  LuShieldAlert,
  LuUsers
} from 'react-icons/lu'

export interface NavItem {
  href: string
  label: string
  icon: IconType
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

/**
 * Navigation items for admin dashboard sidebar
 * Single source of truth - used by Sidebar and MobileMenu
 */
export const navItems: NavItem[] = [
  { href: '/', label: 'Overview', icon: LuLayoutDashboard },
  { href: '/users', label: 'Users', icon: LuUsers },
  { href: '/documents', label: 'Documents', icon: LuFileText },
  { href: '/channels', label: 'Channels', icon: LuMessageSquare },
  { href: '/notifications', label: 'Notifications', icon: LuBell },
  { href: '/system', label: 'System', icon: LuActivity }
]

/**
 * Audit section items — grouped separately in sidebar
 */
export const auditItems: NavItem[] = [
  { href: '/audit/notifications', label: 'Notification Audit', icon: LuShieldAlert },
  { href: '/audit/ghost-accounts', label: 'Ghost Accounts', icon: LuGhost }
]
