import config from '@config'
import type { IconType } from 'react-icons'
import {
  LuBell,
  LuBug,
  LuFileText,
  LuLightbulb,
  LuPalette,
  LuShield,
  LuStar,
  LuUser
} from 'react-icons/lu'

import type { TabType } from './types'

export const MAX_LINKS = 20
export const MIN_PHONE_DIGITS = 7

export const SETTINGS_TABS: { id: TabType; label: string; icon: IconType }[] = [
  { id: 'profile', label: 'Profile', icon: LuUser },
  { id: 'documents', label: 'Documents', icon: LuFileText },
  { id: 'appearance', label: 'Appearance', icon: LuPalette },
  { id: 'security', label: 'Security', icon: LuShield },
  { id: 'notifications', label: 'Notifications', icon: LuBell }
]

export const GITHUB_REPO_URL = config.links.githubRepoUrl

export const SUPPORT_LINKS: { href: string; label: string; icon: IconType }[] = [
  { href: GITHUB_REPO_URL, label: 'Star us on GitHub', icon: LuStar },
  {
    href: `${GITHUB_REPO_URL}/issues/new?template=feature_request.md`,
    label: 'Request a Feature',
    icon: LuLightbulb
  },
  {
    href: `${GITHUB_REPO_URL}/issues/new?template=bug_report.md`,
    label: 'Report an Issue',
    icon: LuBug
  }
]
