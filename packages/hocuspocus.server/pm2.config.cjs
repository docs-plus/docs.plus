const generateConfig = (env) => [
  {
    name: `${env}_rest`,
    script: 'npm run start:production:rest',
    env_production: {
      NODE_ENV: 'production'
    }
  },
  {
    name: `${env}_ws`,
    script: 'npm run start:production:ws',
    env_production: {
      NODE_ENV: 'production'
    }
  }
]

module.exports = {
  apps: [...generateConfig('stage'), ...generateConfig('prod')]
}
