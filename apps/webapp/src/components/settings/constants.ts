import config from '@config'
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
// The skeleton reads it too, so the loading bones match the restored view.
export const DOCUMENTS_VIEW_STORAGE_KEY = 'docsplus:my-docs-view'

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
