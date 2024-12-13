interface ProfileConfig {
  getAvatarURL: (id: string, avatarUpdatedAt: string) => string
  avatarBucketName: string
}

interface AppConfig {
  turnstile: {
    siteKey: string
    verifyUrl: string
    expireTime: number
    isEnabled: boolean
  }
  profile: ProfileConfig
}

interface EditorConfig {
  defaultContent: string
  getDefaultContent: (Heading: string) => string
}

interface ChatConfig {
  systemUserId: string
}

interface Config {
  app: AppConfig
  editor: EditorConfig
  chat: ChatConfig
}

export type { Config }
