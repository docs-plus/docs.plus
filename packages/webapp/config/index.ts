import type { Config } from './types'

const PUBLIC_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`
const AVATARS_BUCKET_URL = `${PUBLIC_BUCKET_URL}/user_avatars`

const config: Config = {
  app: {
    turnstile: {
      isEnabled: process.env.NEXT_PRIVATE_TURNSTILE_SECRET_KEY ? true : false,
      siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
      verifyUrl: '/api/verify-turnstile',
      expireTime: 60 * 60 * 24 * 7 // 1 week
    },
    profile: {
      // "id" is user id, "avatarUpdatedAt" is the timestamp of the avatar update
      getAvatarURL: (id: string, avatarUpdatedAt: string) => {
        return `${AVATARS_BUCKET_URL}/public/${id}.png?${avatarUpdatedAt}`
      },
      avatarBucketName: 'user_avatars'
    }
  },
  chat: {
    systemUserId: '992bb85e-78f8-4747-981a-fd63d9317ff1'
  },
  editor: {
    defaultContent: `<h1>Welcome to Your New Document</h1>
      <p>This is the default content for your new document. Feel free to start editing!</p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
    `,
    getDefaultContent: (Heading: string = 'Welcome to Your New Document') => {
      return `<h1>${Heading}</h1>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
      `
    }
  }
}

export default config
