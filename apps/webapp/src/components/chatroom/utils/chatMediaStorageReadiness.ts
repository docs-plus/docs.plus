import type { MessageMediaItem } from '@types'
import { supabaseClient } from '@utils/supabase'

import { CHAT_MEDIA_BUCKET, collectMediaInsertPaths } from './messageMediaPaths'

export const isChatMediaObjectNotFoundError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error != null &&
          'message' in error &&
          typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : ''
  return message.toLowerCase().includes('media object not found')
}

async function verifyChatMediaStorageObjects(paths: string[]): Promise<boolean> {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  if (uniquePaths.length === 0) return false

  const checks = await Promise.all(
    uniquePaths.map(async (path) => {
      const { data, error } = await supabaseClient.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(path, 60)
      return !error && Boolean(data?.signedUrl)
    })
  )

  return checks.every(Boolean)
}

type AwaitReadyOptions = {
  maxAttempts?: number
  delayMs?: number
}

/** Mirrors `validate_message_medias()` storage EXISTS check — call before INSERT/UPDATE with medias. */
async function awaitChatMediaStorageReady(
  paths: string[],
  options?: AwaitReadyOptions
): Promise<boolean> {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  if (uniquePaths.length === 0) return true

  const maxAttempts = options?.maxAttempts ?? 6
  const delayMs = options?.delayMs ?? 150

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await verifyChatMediaStorageObjects(uniquePaths)) return true
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return false
}

export async function ensureChatMediaInsertReady(
  medias: MessageMediaItem[],
  options?: AwaitReadyOptions
): Promise<boolean> {
  return awaitChatMediaStorageReady(collectMediaInsertPaths(medias), options)
}
