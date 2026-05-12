export interface ChatroomVariant {
  mobile: 'mobile'
  desktop: 'desktop'
}

export interface ChatroomProps {
  variant?: keyof ChatroomVariant
  className?: string
  children: React.ReactNode
}

export interface DialogConfig {
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

export interface ChatroomContextValue {
  channelId: string
  variant: keyof ChatroomVariant
  error: string | null
  isChannelDataLoaded: boolean
  isDbSubscriptionReady: boolean
  // Dialog API
  openDialog: (content: React.ReactNode, config?: DialogConfig) => void
  closeDialog: () => void
  isDialogOpen: boolean
  initLoadMessages: boolean
}
