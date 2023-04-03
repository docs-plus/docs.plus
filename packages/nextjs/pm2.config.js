module.exports = {
  apps: [{
    name: "stage",
    script: "npm start",
    env_production: {
      NODE_ENV: "production"
    },
    env_development: {
      NODE_ENV: "development"
    }
  }]
}
