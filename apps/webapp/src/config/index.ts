import './env' // Validate environment variables on startup

import type { Config } from './types'

const PUBLIC_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`
const AVATARS_BUCKET_URL = `${PUBLIC_BUCKET_URL}/user_avatars`

const config: Config = {
  app: {
    profile: {
      // `{userId}/avatar.png` encodes ownership for RLS
      // `(storage.foldername(name))[1] === auth.uid()`. `?{avatarUpdatedAt}`
      // busts the browser cache after each change.
      getAvatarURL: (id: string, avatarUpdatedAt: string) => {
        return `${AVATARS_BUCKET_URL}/${id}/avatar.png?${avatarUpdatedAt}`
      },
      avatarBucketName: 'user_avatars'
    }
  },
  chat: {
    systemUserId: '992bb85e-78f8-4747-981a-fd63d9317ff1'
  },
  links: {
    githubRepoUrl: 'https://github.com/docs-plus/docs.plus'
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
