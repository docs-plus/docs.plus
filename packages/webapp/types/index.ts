import { Database } from './supabase'

interface LinkItem {
  url: string
  type: string
  metadata: {
    title?: string
    description?: string
    icon?: string
    socialBanner?: string
    socialBannerSize?: {
      width: number
      height: number
    }
    themeColor?: string
  }
}

interface ProfileData {
  bio?: string
  linkTree?: LinkItem[]
}

export type { TChannelSettings } from './stores'
export type { Database }
export type Channel = Database['public']['Tables']['channels']['Row'] | null
export type Profile = Omit<Database['public']['Tables']['users']['Row'], 'profile_data'> & {
  profile_data?: ProfileData
  channelId?: string | null
}
