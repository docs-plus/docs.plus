module.exports = {
    apps : [
      {
      name: "docs_plus_prod",
      script: "./node_modules/ep_etherpad-lite/node/server.js",
      env: {
        NODE_ENV: "production",

      },
    },
    {
      name: "docs_plus_dev",
      script: "./node_modules/ep_etherpad-lite/node/server.js",
      env: {
        NODE_ENV: "development",
      },
    }

  ]
  }