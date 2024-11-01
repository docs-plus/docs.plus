interface AppConfig {
  turnstile: {
    siteKey: string
    verifyUrl: string
    expireTime: number
    isEnabled: boolean
  }
}

interface EditorConfig {
  defaultContent: string
  getDefaultContent: (Heading: string) => string
}

interface Config {
  app: AppConfig
  editor: EditorConfig
}

export type { Config }
