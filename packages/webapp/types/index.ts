import { Database } from './supabase'

export type { TChannelSettings } from './stores'
export type { Database }
export type Channel = Database['public']['Tables']['channels']['Row'] | null
