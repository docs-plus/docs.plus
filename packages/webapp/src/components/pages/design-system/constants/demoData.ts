/**
 * Design System Page - Demo Data
 * ===============================
 * Mock data for demonstrating UI components in the design system.
 */

import {
  MdDashboard,
  MdDescription,
  MdEdit,
  MdOutlineArticle,
  MdPalette,
  MdPeople,
  MdSettings
} from 'react-icons/md'

import type {
  DemoDocument,
  DemoMessage,
  DemoUser,
  FolderItem,
  KeyboardShortcut,
  NavItem,
  PlanOption
} from '../types'

export const DEMO_USERS: DemoUser[] = [
  { id: 'user-1', name: 'Sarah Miller', email: 'sarah@docs.plus', role: 'Admin', status: 'online' },
  { id: 'user-2', name: 'Alex Chen', email: 'alex@docs.plus', role: 'Editor', status: 'away' },
  {
    id: 'user-3',
    name: 'Jordan Lee',
    email: 'jordan@docs.plus',
    role: 'Viewer',
    status: 'offline'
  },
  { id: 'user-4', name: 'Casey Brown', email: 'casey@docs.plus', role: 'Editor', status: 'online' }
]

export const DEMO_DOCUMENTS: DemoDocument[] = [
  { id: 1, name: 'Q4 Product Roadmap', status: 'Published', modified: '2 hours ago', views: 234 },
  { id: 2, name: 'Engineering Specs v2.1', status: 'Draft', modified: 'Yesterday', views: 89 },
  { id: 3, name: 'Team Meeting Notes', status: 'Published', modified: '3 days ago', views: 156 },
  { id: 4, name: 'Design System Guidelines', status: 'Review', modified: '1 week ago', views: 412 }
]

export const DEMO_MESSAGES: DemoMessage[] = [
  {
    id: 1,
    user: 'Sarah Miller',
    userId: 'chat-1',
    message: 'Hey team! The new design system is looking great 🎨',
    time: '10:32 AM',
    isMe: false
  },
  {
    id: 2,
    user: 'Alex Chen',
    userId: 'chat-2',
    message: 'Agreed! Love the new color palette',
    time: '10:34 AM',
    isMe: false
  },
  {
    id: 3,
    user: 'You',
    userId: 'chat-3',
    message: "Thanks! I've just pushed the latest updates. Check out the components section.",
    time: '10:36 AM',
    isMe: true
  },
  {
    id: 4,
    user: 'Sarah Miller',
    userId: 'chat-1',
    message: 'Will do! Are we ready for the demo?',
    time: '10:38 AM',
    isMe: false
  }
]

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: MdDashboard, badge: null },
  { id: 'documents', label: 'Documents', icon: MdDescription, badge: '12' },
  { id: 'foundations', label: 'Foundations', icon: MdPalette, badge: null },
  { id: 'team', label: 'Team', icon: MdPeople, badge: null },
  { id: 'components', label: 'Components', icon: MdOutlineArticle, badge: 'New' },
  { id: 'forms', label: 'Forms', icon: MdEdit, badge: null },
  { id: 'settings', label: 'Settings', icon: MdSettings, badge: null }
]

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { label: 'New document', keys: ['⌘', 'N'] },
  { label: 'Search', keys: ['⌘', 'K'] },
  { label: 'Save', keys: ['⌘', 'S'] },
  { label: 'Toggle theme', keys: ['⌘', 'D'] },
  { label: 'Open settings', keys: ['⌘', ','] },
  { label: 'Close panel', keys: ['Esc'] }
]

export const FOLDER_ITEMS: FolderItem[] = [
  {
    name: 'Design Resources',
    files: 12,
    open: true,
    items: ['Brand Guidelines.pdf', 'Component Library.fig', 'Color Palette.png']
  },
  {
    name: 'Documentation',
    files: 8,
    open: false,
    items: ['Getting Started.md', 'API Reference.md']
  },
  { name: 'Meeting Notes', files: 24, open: false, items: null }
]

export const PLAN_OPTIONS: PlanOption[] = [
  { id: 'free', name: 'Free', desc: 'Basic features', price: '$0/mo' },
  { id: 'pro', name: 'Pro', desc: 'Advanced features', price: '$9/mo' },
  { id: 'enterprise', name: 'Enterprise', desc: 'Custom solutions', price: 'Contact us' }
]
