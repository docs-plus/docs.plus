import config from '@config'
import type { ThemePreference } from '@stores'
import { isDocumentReportPath } from '@utils/reportContent'
import type { IconType } from 'react-icons'
import {
  LuBell,
  LuBug,
  LuFileText,
  LuLightbulb,
  LuPalette,
  LuPlug,
  LuShield,
  LuStar,
  LuTriangleAlert,
  LuUser
} from 'react-icons/lu'

import type { SupportRow, TabType } from './types'

export const MAX_LINKS = 20
export const MIN_PHONE_DIGITS = 7

export type DocumentViewMode = 'list' | 'grid'
export const DOCUMENTS_VIEW_STORAGE_KEY = 'docsplus:my-docs-view'

/** The restored view. The skeleton reads it too, so the loading bones match it. */
export const readDocumentsViewMode = (): DocumentViewMode => {
  if (typeof window === 'undefined') return 'list'
  return window.sessionStorage.getItem(DOCUMENTS_VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list'
}

/** Picker entries are the explicit (non-`system`) preferences; `system` is a separate row. */
export type PickerTheme = Exclude<ThemePreference, 'system'>

export type ThemeChoice = {
  value: PickerTheme
  label: string
  premium?: boolean
}

// The Appearance picker and its skeleton draw the same lists in the same order.
export const LIGHT_THEMES: ThemeChoice[] = [
  { value: 'light', label: 'Light' },
  { value: 'graphite-light', label: 'Graphite', premium: true },
  { value: 'paper-light', label: 'Paper', premium: true }
]

export const DARK_THEMES: ThemeChoice[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'graphite-dark', label: 'Graphite', premium: true },
  { value: 'paper-dark', label: 'Paper', premium: true },
  { value: 'dark-hc', label: 'High contrast' }
]

/** The `scope` the documents list sends. Settings and Home default to `all`; Command
 *  jump reads `owned`. An unknown stored value falls back to `all`. */
export type DocumentsScope = 'all' | 'owned' | 'joined'
export const DOCUMENTS_SCOPE_STORAGE_KEY = 'docsplus:my-docs-scope'
export const DOCUMENTS_SORT_STORAGE_KEY = 'docsplus:my-docs-sort'

// Settings and the Home card show one text for an empty pick. All and Owned share `owned`.
export const DOCUMENTS_EMPTY_TEXT = {
  owned: { title: 'No documents yet.', body: 'Documents you create will appear here.' },
  joined: {
    title: 'No joined documents yet.',
    body: 'Documents you open while signed in appear here.'
  }
} as const

// `fullWidth` opts a section out of the centered max-w-2xl reading column (the
// documents grid/list needs the whole panel width).
export const SETTINGS_TABS: { id: TabType; label: string; icon: IconType; fullWidth?: boolean }[] =
  [
    { id: 'profile', label: 'Profile', icon: LuUser },
    { id: 'documents', label: 'Documents', icon: LuFileText, fullWidth: true },
    { id: 'appearance', label: 'Appearance', icon: LuPalette },
    { id: 'security', label: 'Security', icon: LuShield },
    { id: 'notifications', label: 'Notifications', icon: LuBell },
    { id: 'connected-apps', label: 'Connected apps', icon: LuPlug }
  ]

export const GITHUB_REPO_URL = config.links.githubRepoUrl
export const MCP_GUIDE_URL = `${GITHUB_REPO_URL}/blob/main/docs/mcp/README.md`

export const SUPPORT_ROWS: SupportRow[] = [
  {
    kind: 'link',
    href: GITHUB_REPO_URL,
    label: 'Star us on GitHub',
    icon: LuStar,
    ink: 'accent',
    burst: 'star'
  },
  {
    kind: 'link',
    href: `${GITHUB_REPO_URL}/issues/new?template=feature_request.md`,
    label: 'Request a feature',
    icon: LuLightbulb,
    ink: 'warning'
  },
  {
    kind: 'link',
    href: `${GITHUB_REPO_URL}/issues/new?template=bug_report.md`,
    label: 'Report an issue',
    icon: LuBug,
    ink: 'error'
  },
  {
    kind: 'action',
    label: 'Report a problem',
    icon: LuTriangleAlert,
    ink: 'warning'
  }
]

/** The Report row only on a pad path, where there is a document to report. */
export const supportRowsFor = (pathname: string): SupportRow[] =>
  isDocumentReportPath(pathname)
    ? SUPPORT_ROWS
    : SUPPORT_ROWS.filter((row) => row.kind !== 'action')
