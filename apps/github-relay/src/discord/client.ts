import type { DiscordTransport, DiscordV2Payload } from '../types.ts'
import { IS_COMPONENTS_V2_FLAG } from './renderer.ts'

const DISCORD_API_BASE = 'https://discord.com/api/v10'
const MAX_ATTEMPTS = 4

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampRetryMs(seconds: number): number {
  const safeSec = Number.isFinite(seconds) && seconds > 0 && seconds <= 30 ? seconds : 5
  const jitter = Math.floor(Math.random() * 150) + 50
  return Math.round(safeSec * 1000) + jitter
}

export class DiscordHttpClient implements DiscordTransport {
  private readonly botToken: string

  constructor(botToken: string) {
    this.botToken = botToken
  }

  async sendMessage(channelId: string, payload: DiscordV2Payload): Promise<{ id: string }> {
    const res = await this.requestWithRetry(
      'POST',
      `${DISCORD_API_BASE}/channels/${channelId}/messages`,
      payload
    )
    if (!res.ok) {
      throw new Error(`Discord POST failed (${res.status}): ${res.body}`)
    }
    const parsed = JSON.parse(res.body) as { id?: string }
    if (!parsed.id) {
      throw new Error('Discord POST returned 2xx without message id')
    }
    return { id: parsed.id }
  }

  async editMessage(
    channelId: string,
    messageId: string,
    payload: DiscordV2Payload
  ): Promise<{ id: string } | { notFound: true }> {
    // Discord PATCH rejects message_reference and toggling SUPPRESS_NOTIFICATIONS.
    const editPayload: DiscordV2Payload = {
      flags: IS_COMPONENTS_V2_FLAG,
      components: payload.components,
      allowed_mentions: payload.allowed_mentions
    }
    const res = await this.requestWithRetry(
      'PATCH',
      `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
      editPayload
    )
    if (res.status === 404) {
      return { notFound: true }
    }
    if (!res.ok) {
      throw new Error(`Discord PATCH failed (${res.status}): ${res.body}`)
    }
    const parsed = JSON.parse(res.body) as { id?: string }
    return { id: parsed.id || messageId }
  }

  private async requestWithRetry(
    method: 'POST' | 'PATCH',
    url: string,
    body: DiscordV2Payload
  ): Promise<{ ok: boolean; status: number; body: string }> {
    const jsonBody = JSON.stringify(body)

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let resp: Response
      try {
        resp = await fetch(url, {
          method,
          headers: {
            Authorization: `Bot ${this.botToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'docsplus-github-relay (https://docs.plus, 1.0)'
          },
          body: jsonBody
        })
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) throw err
        await sleep(500 * Math.pow(3, attempt - 1))
        continue
      }

      const text = await resp.text()
      if (resp.ok) {
        return { ok: true, status: resp.status, body: text }
      }

      if (resp.status === 404) {
        return { ok: false, status: 404, body: text }
      }

      if (resp.status === 429 && attempt < MAX_ATTEMPTS) {
        let retryAfterSec = 5
        try {
          const data = JSON.parse(text) as { retry_after?: number }
          if (typeof data.retry_after === 'number') retryAfterSec = data.retry_after
        } catch {
          const headerVal = Number(resp.headers.get('retry-after'))
          if (Number.isFinite(headerVal) && headerVal > 0) retryAfterSec = headerVal
        }
        await sleep(clampRetryMs(retryAfterSec))
        continue
      }

      if (resp.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(500 * Math.pow(3, attempt - 1))
        continue
      }

      return { ok: false, status: resp.status, body: text }
    }

    throw new Error('Exhausted Discord retry attempts')
  }
}
