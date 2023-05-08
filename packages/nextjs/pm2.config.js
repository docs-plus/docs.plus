module.exports = {
  apps: [
    {
      name: 'nextjs_stage',
      script: 'npm run start:stage',
      env_development: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'nextjs_production',
      script: 'npm run start:prod',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
