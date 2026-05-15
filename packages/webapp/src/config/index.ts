import './env' // Validate environment variables on startup

import type { Config } from './types'

const PUBLIC_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`
const AVATARS_BUCKET_URL = `${PUBLIC_BUCKET_URL}/user_avatars`

const config: Config = {
  app: {
    profile: {
      // Path: `{userId}/avatar.png` inside the user_avatars bucket. The
      // {userId} folder prefix encodes ownership — the bucket's RLS
      // policies parse it via `(storage.foldername(name))[1]` and compare
      // against `auth.uid()`, so storage writes only succeed when the
      // path's first folder matches the caller's user id.
      // The `?{avatarUpdatedAt}` query string busts the browser cache
      // on every avatar change.
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
