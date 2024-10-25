import type { Config } from './types'

const config: Config = {
  app: {
    turnstile: {
      siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
      verifyUrl: '/api/verify-turnstile',
      expireTime: 60 * 60 * 24 * 2 // 24 hours
    }
  },
  editor: {
    defaultContent: `<h1>Welcome to Your New Document</h1>
      <p>This is the default content for your new document. Feel free to start editing!</p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
    `,
    getDefaultContent: (Heading: string) => {
      return `<h1>${Heading}</h1>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      `
    }
  }
}

export default config
