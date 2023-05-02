module.exports = {
  apps: [{
    name: "stage_rest",
    script: "npm run start:production:rest",
    env_production: {
      NODE_ENV: "production",
      DATABASE_TYPE: "PostgreSQL"
    },
    env_development: {
      NODE_ENV: "development"
    }
  },
  {
    name: "stage_ws",
    script: "npm run start:production:ws",
    env_production: {
      NODE_ENV: "production",
      DATABASE_TYPE: "PostgreSQL"
    },
    env_development: {
      NODE_ENV: "development"
    }
  }],
}
