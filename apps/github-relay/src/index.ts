import { loadConfig } from './config.ts'
import { DiscordHttpClient } from './discord/client.ts'
import { GitHubHttpClient } from './github/client.ts'
import { ChannelQueue } from './queue/channelQueue.ts'
import { createRelayHandler } from './server.ts'
import { SqliteStore } from './store/sqliteStore.ts'

async function main(): Promise<void> {
  const config = loadConfig()
  const store = new SqliteStore(config.sqlitePath)
  const discord = new DiscordHttpClient(config.discordBotToken)
  const github = new GitHubHttpClient(config.githubToken)
  const queue = new ChannelQueue(config, store, discord, github)

  queue.start(500)

  const handler = createRelayHandler({ config, store, queue })
  const server = Bun.serve({
    port: config.port,
    hostname: '0.0.0.0',
    fetch: handler
  })

  console.log(`[github-relay] Listening on 0.0.0.0:${server.port} for ${config.githubRepository}`)

  const cronTimer = setInterval(() => {
    const now = new Date()
    const utcDay = now.getUTCDay()
    const utcHour = now.getUTCHours()

    if (config.digestEnabled) {
      if (utcDay >= 1 && utcDay <= 5 && utcHour === config.dailyDigestHourUtc) {
        void queue.runDigest('daily').catch((err) => {
          console.error('[github-relay] Daily digest failed:', err)
        })
      }
      if (utcDay === config.weeklyPulseDayUtc && utcHour === config.weeklyPulseHourUtc) {
        void queue.runDigest('weekly').catch((err) => {
          console.error('[github-relay] Weekly pulse failed:', err)
        })
      }
    }

    if (utcHour === 3 && now.getUTCMinutes() === 0) {
      store.pruneOldRecords()
    }
  }, 60_000)

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[github-relay] Received ${signal}; draining queue`)
    clearInterval(cronTimer)
    server.stop(false)
    await queue.stop()
    store.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
}

main().catch((err) => {
  console.error('[github-relay] Fatal startup error:', err)
  process.exit(1)
})
