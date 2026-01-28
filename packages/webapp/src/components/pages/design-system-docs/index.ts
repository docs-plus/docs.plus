/**
 * Design System Documentation - Module Index
 * ===========================================
 * Developer-facing design system documentation for DocsPlus.
 *
 * ## Usage
 *
 * ```tsx
 * import { DesignSystemDocsPage } from '@components/pages/design-system-docs'
 *
 * export default DesignSystemDocsPage
 * ```
 */

// Main page component
export { DesignSystemDocsPage } from './DesignSystemDocsPage'

// Context
export { DesignSystemDocsProvider, useDesignSystemDocs } from './context/DesignSystemDocsContext'

// Components
export {
  Sidebar,
  Header,
  CopyButton,
  CodeBlock,
  SectionHeader,
  ComponentCard,
  ColorSwatch,
  GettingStartedSection,
  FoundationsSection,
  ComponentsSection,
  EditorComponentsSection,
  PatternsSection,
  AccessibilitySection,
  ImplementationSection
} from './components'

// Types
export type * from './types'

// Constants
export * from './constants'
