/**
 * Design System Documentation Types
 * ==================================
 */

export interface NavSection {
  id: string
  title: string
  items: NavItem[]
}

export interface NavItem {
  id: string
  label: string
  icon?: React.ComponentType<{ size?: number }>
}

export interface ColorToken {
  name: string
  cssVar: string
  value: string
  usage: string
}

export interface SpacingToken {
  name: string
  value: string
  pixels: string
}

export interface ComponentExample {
  id: string
  name: string
  description: string
  variants?: string[]
  useWhen?: string[]
  avoidWhen?: string[]
  code: string
  importPath: string
}

export interface PatternExample {
  id: string
  name: string
  description: string
  doRules: string[]
  dontRules: string[]
}

export interface AccessibilityItem {
  category: string
  items: {
    label: string
    checked: boolean
    description?: string
  }[]
}

export type SearchResult = {
  type: 'section' | 'component' | 'pattern' | 'token'
  id: string
  title: string
  section: string
}
