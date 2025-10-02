interface PM2ProcessConfig {
  name: string
  script: string
  args: string[]
  instances: number | 'max'
  exec_mode: 'cluster' | 'fork'
  watch: boolean
  max_memory_restart: string
  env_production: {
    NODE_ENV: string
  }
  error_file: string
  out_file: string
  log_date_format: string
  merge_logs: boolean
  autorestart: boolean
  max_restarts: number
  min_uptime: string
  listen_timeout: number
  kill_timeout: number
}

const generateConfig = (env: 'stage' | 'prod'): PM2ProcessConfig[] => [
  {
    name: `${env}_rest`,
    script: 'bun',
    args: ['run', 'start:production:rest'],
    instances: 1, // REST API - single instance (Hono is very fast)
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: `./logs/${env}-rest-error.log`,
    out_file: `./logs/${env}-rest-out.log`,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 10000,
    kill_timeout: 5000
  },
  {
    name: `${env}_ws`,
    script: 'bun',
    args: ['run', 'start:production:ws'],
    instances: 1, // WebSocket - must be single instance for Hocuspocus
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: `./logs/${env}-ws-error.log`,
    out_file: `./logs/${env}-ws-out.log`,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 10000,
    kill_timeout: 5000
  }
]

export default {
  apps: [...generateConfig('stage'), ...generateConfig('prod')]
}
