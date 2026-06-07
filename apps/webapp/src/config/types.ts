interface ProfileConfig {
  getAvatarURL: (id: string, avatarUpdatedAt: string) => string
  avatarBucketName: string
}

interface AppConfig {
  profile: ProfileConfig
}

interface EditorConfig {
  defaultContent: string
  getDefaultContent: (Heading: string) => string
}

interface ChatConfig {
  systemUserId: string
}

interface LinksConfig {
  githubRepoUrl: string
}

interface Config {
  app: AppConfig
  editor: EditorConfig
  chat: ChatConfig
  links: LinksConfig
}

export type { Config }
