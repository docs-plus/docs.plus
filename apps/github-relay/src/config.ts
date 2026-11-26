import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import type { ChannelKey, RelayConfig } from './types.ts'

const SNOWFLAKE_RE = /^\d{17,22}$/

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const val = env[key]?.trim()
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function requireSnowflake(env: NodeJS.ProcessEnv, key: string): string {
  const val = requireEnv(env, key)
  if (!SNOWFLAKE_RE.test(val)) {
    throw new Error(`${key} must be a 17-22 digit Discord numeric ID`)
  }
  return val
}

function parseIntBounded(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < min || n > max) return fallback
  return n
}

export function loadDiscordUsersMap(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as {
      users?: Record<string, unknown>
    }
    const entries = raw.users ?? {}
    const out: Record<string, string> = {}
    for (const [login, id] of Object.entries(entries)) {
      if (login.startsWith('_')) continue
      if (typeof id === 'string' && SNOWFLAKE_RE.test(id.trim())) {
        out[login] = id.trim()
      } else {
        console.warn(`[config] Ignored invalid Discord ID for GitHub user "${login}"`)
      }
    }
    return out
  } catch (err) {
    console.warn(`[config] Failed to read ${filePath}:`, err)
    return {}
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  const githubChannelId = requireSnowflake(env, 'DISCORD_GITHUB_CHANNEL_ID')
  const rawTriageId = env.DISCORD_TRIAGE_CHANNEL_ID?.trim()
  if (rawTriageId && !SNOWFLAKE_RE.test(rawTriageId)) {
    throw new Error('DISCORD_TRIAGE_CHANNEL_ID must be a 17-22 digit Discord numeric ID')
  }
  const triageChannelId = rawTriageId || githubChannelId
  const releasesChannelId = requireSnowflake(env, 'DISCORD_RELEASES_CHANNEL_ID')

  const usersMapPath =
    env.DISCORD_USERS_MAP_PATH?.trim() || resolve(import.meta.dir, '../discord-users.json')

  const channels: Record<ChannelKey, string> = {
    github: githubChannelId,
    triage: triageChannelId,
    releases: releasesChannelId
  }

  return {
    port: parseIntBounded(env.PORT, 4050, 1, 65535),
    sqlitePath: env.SQLITE_PATH?.trim() || '/data/relay.sqlite',
    githubRepository: env.GITHUB_REPOSITORY?.trim() || 'docs-plus/docs.plus',
    githubWebhookSecret: requireEnv(env, 'GITHUB_WEBHOOK_SECRET'),
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    discordBotToken: requireEnv(env, 'DISCORD_BOT_TOKEN'),
    channels,
    hasDistinctTriageChannel: triageChannelId !== githubChannelId,
    discordUsers: loadDiscordUsersMap(usersMapPath),
    relayAdminToken: env.RELAY_ADMIN_TOKEN?.trim() || null,
    pushCoalesceMs: parseIntBounded(env.PUSH_COALESCE_MS, 12000, 0, 300000),
    issueOpenCoalesceMs: parseIntBounded(env.ISSUE_OPEN_COALESCE_MS, 10000, 0, 300000),
    triageBurstWindowMs: parseIntBounded(env.TRIAGE_BURST_WINDOW_MS, 45000, 0, 300000),
    starBurstWindowMs: parseIntBounded(env.STAR_BURST_WINDOW_MS, 30000, 0, 300000),
    digestEnabled: env.DIGEST_ENABLED !== 'false',
    dailyDigestHourUtc: parseIntBounded(env.DAILY_DIGEST_HOUR_UTC, 9, 0, 23),
    biweeklyReportDayUtc: parseIntBounded(env.BIWEEKLY_REPORT_DAY_UTC, 5, 0, 6),
    biweeklyReportHourUtc: parseIntBounded(env.BIWEEKLY_REPORT_HOUR_UTC, 16, 0, 23),
    monthlyReportDayUtc: parseIntBounded(env.MONTHLY_REPORT_DAY_UTC, 1, 1, 28),
    monthlyReportHourUtc: parseIntBounded(env.MONTHLY_REPORT_HOUR_UTC, 16, 0, 23),
    appUrl: env.APP_URL?.trim() || 'https://docs.plus',
    selfHostDocsUrl:
      env.SELF_HOST_DOCS_URL?.trim() ||
      'https://github.com/docs-plus/docs.plus/blob/main/docs/self-hosting/README.md'
  }
}
