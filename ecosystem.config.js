module.exports = {
    apps : [
      {
      name: "digitalocean",
      script: "./node_modules/ep_etherpad-lite/node/server.js",
      env: {
        NODE_ENV: "production",
        PORT:"9001",
        DB_USER : `${process.env.DB_USER}`,
        DB_PASS : `${process.env.DB_PASS}`,
        DB_HOST : `${process.env.DB_HOST}`,
        DB_TYPE : `${process.env.DB_TYPE}`,
        DB_PORT : `${process.env.DB_PORT}`,
        DB_NAME : `${process.env.DB_NAME}`,
      },
    },
    {
      name: "docs_plus_dev",
      script: "./node_modules/ep_etherpad-lite/node/server.js",
      env: {
        NODE_ENV: "development",
        PORT:"9002",

      },
    }

  ]
  }