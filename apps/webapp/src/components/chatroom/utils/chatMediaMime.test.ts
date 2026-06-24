import { readFileSync } from 'fs'
import { join } from 'path'

import {
  CHAT_MEDIA_ALLOWED_EXTENSIONS,
  CHAT_MEDIA_ALLOWED_MIME_TYPES,
  CHAT_MEDIA_BLOCKED_EXTENSIONS,
  isChatMediaMimeAllowed,
  resolveChatMediaMime,
  validateChatMediaFile
} from './chatMediaMime'

const fakeFile = (type: string, name: string, size = 1024): File =>
  ({ type, name, size }) as unknown as File

const repoRoot = join(__dirname, '../../../../../..')
const bucketsSql = readFileSync(join(repoRoot, 'packages/supabase/scripts/12-buckets.sql'), 'utf8')
const messageSql = readFileSync(
  join(repoRoot, 'packages/supabase/scripts/10-3-func-message.sql'),
  'utf8'
)

describe('chatMediaMime parity', () => {
  const mediaBucketSection = bucketsSql.split("('media', 'media'")[1] ?? ''

  it('lists every allowed MIME in the media bucket script', () => {
    for (const mime of CHAT_MEDIA_ALLOWED_MIME_TYPES) {
      expect(mediaBucketSection).toContain(`'${mime}'`)
    }
    expect(mediaBucketSection).not.toContain('image/svg+xml')
  })

  it('lists every allowed extension in validate_message_medias', () => {
    for (const ext of CHAT_MEDIA_ALLOWED_EXTENSIONS) {
      expect(messageSql).toContain(`'${ext}'`)
    }
  })

  it('blocks svg in FE and SQL', () => {
    expect(CHAT_MEDIA_BLOCKED_EXTENSIONS.has('svg')).toBe(true)
    expect(messageSql).toContain("'svg'")
  })
})

describe('resolveChatMediaMime', () => {
  // MediaRecorder tags voice notes `audio/webm;codecs=opus`; the storage bucket
  // allowlist matches the bare type only, so the parameter must be stripped or
  // the upload is rejected ("mime type audio/webm;codecs=opus … not supported").
  it('strips MIME parameters so codec-tagged voice notes match the allowlist', () => {
    const voiceNote = fakeFile('audio/webm;codecs=opus', 'voice-1782237320394.webm')
    expect(resolveChatMediaMime(voiceNote)).toBe('audio/webm')
    expect(isChatMediaMimeAllowed(resolveChatMediaMime(voiceNote))).toBe(true)
    expect(validateChatMediaFile(voiceNote)).toBeNull()
  })

  it('passes plain types through unchanged', () => {
    expect(resolveChatMediaMime(fakeFile('image/png', 'a.png'))).toBe('image/png')
  })
})
