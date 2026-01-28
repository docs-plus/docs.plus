/**
 * Design System Page - Module Index
 * ===================================
 * Main entry point for the design system demo page.
 *
 * This module provides a complete, self-contained design system showcase
 * with proper separation of concerns following abstraction layer patterns.
 *
 * ## Architecture
 *
 * ```
 * design-system/
 * ├── index.ts                    # This file - main exports
 * ├── types/                      # TypeScript type definitions
 * ├── constants/                  # Demo data and configuration
 * ├── context/                    # React context for state management
 * ├── layouts/                    # Layout wrapper components
 * └── components/                 # UI components
 *     ├── navigation/             # Sidebar, Header
 *     ├── tabs/                   # Tab content components
 *     ├── cards/                  # Reusable card components
 *     └── chat/                   # Chat panel component
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * import { DesignSystemPage } from '@components/pages/design-system'
 *
 * // In your page component:
 * export default DesignSystemPage
 * ```
 */

// Main page component
export { DesignSystemPage } from './DesignSystemPage'

// Context provider and hook
export { DesignSystemProvider, useDesignSystem } from './context/DesignSystemContext'

// Layouts
export { DashboardLayout } from './layouts'

// Components
export {
  Sidebar,
  Header,
  StatCard,
  ActionCard,
  DashboardTab,
  DocumentsTab,
  TeamTab,
  ComponentsTab,
  FormsTab,
  SettingsTab,
  ChatPanel
} from './components'

// Types
export type {
  TabType,
  ThemeType,
  UserStatus,
  UserRole,
  DocumentStatus,
  DemoUser,
  DemoDocument,
  DemoMessage,
  NavItem,
  KeyboardShortcut,
  FolderItem,
  PlanOption
} from './types'

// Constants
export {
  DEMO_USERS,
  DEMO_DOCUMENTS,
  DEMO_MESSAGES,
  NAV_ITEMS,
  KEYBOARD_SHORTCUTS,
  FOLDER_ITEMS,
  PLAN_OPTIONS
} from './constants/demoData'
