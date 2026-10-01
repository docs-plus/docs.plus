import type { IconType } from 'react-icons'
import {
  LuActivity,
  LuBell,
  LuFileText,
  LuGhost,
  LuHardDrive,
  LuLayoutDashboard,
  LuMessageSquare,
  LuPlug,
  LuShieldAlert,
  LuUsers
} from 'react-icons/lu'

export interface NavItem {
  href: string
  label: string
  icon: IconType
}

// Both lists feed NavLinks, the one nav of the Sidebar and the MobileMenu.
export const navItems: NavItem[] = [
  { href: '/', label: 'Overview', icon: LuLayoutDashboard },
  { href: '/users', label: 'Users', icon: LuUsers },
  { href: '/documents', label: 'Documents', icon: LuFileText },
  { href: '/channels', label: 'Channels', icon: LuMessageSquare },
  { href: '/notifications', label: 'Notifications', icon: LuBell },
  { href: '/storage', label: 'Media Storage', icon: LuHardDrive },
  { href: '/mcp', label: 'MCP Usage', icon: LuPlug },
  { href: '/system', label: 'System', icon: LuActivity }
]

export const auditItems: NavItem[] = [
  { href: '/audit/notifications', label: 'Notification Audit', icon: LuShieldAlert },
  { href: '/audit/ghost-accounts', label: 'Ghost Accounts', icon: LuGhost }
]
