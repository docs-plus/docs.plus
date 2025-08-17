const os = require('os')

module.exports = {
  apps: [
    {
      name: 'nextjs_stage',
      script: 'npm run start:stage',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_development: {
        NODE_ENV: 'development'
      },
      // PM2 uses app name for log files by default
      // Actual files: nextjs-stage-out.log, nextjs-stage-error.log
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Auto restart configuration
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      // Memory and monitoring
      max_memory_restart: '500M',
      // Health monitoring
      health_check_grace_period: 3000
    },
    {
      name: 'nextjs_production',
      script: 'npm run start:prod',
      instances: Math.max(1, os.cpus().length - 1), // Use all cores minus 1 for system
      exec_mode: 'cluster',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        // Performance optimizations
        NODE_OPTIONS: '--max-old-space-size=2048 --max-semi-space-size=128',
        // Enable source maps for better error tracking
        NEXT_TELEMETRY_DISABLED: 1
      },
      // PM2 uses app name for log files by default
      // Actual files: nextjs-production-out.log, nextjs-production-error.log
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json', // Structured logging
      // Auto restart and reliability
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 2000,
      // Memory management
      max_memory_restart: '1G',
      // Performance monitoring
      monitoring: true,
      pmx: true,
      // Health monitoring
      health_check_grace_period: 5000,
      kill_timeout: 10000,
      listen_timeout: 8000,
      // Process limits
      max_old_space_size: 2048,
      // Graceful reload
      wait_ready: true,
      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: '0 3 * * *',
      // Error handling
      exp_backoff_restart_delay: 100,
      // Additional environment variables for production
      env: {
        NODE_ENV: 'production',
        // Enable PM2 monitoring
        PM2_SERVE_PATH: '.',
        PM2_SERVE_PORT: 8080,
        PM2_SERVE_SPA: 'false'
      }
    }
  ],
  // Global PM2 configuration
  deploy: {
    production: {
      'post-deploy':
        'npm ci && npm run build && pm2 reload ecosystem.config.js --only nextjs_production --env production && pm2 save'
    }
  }
}
