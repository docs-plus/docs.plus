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
        BUCKET_S3_SERVER : `${process.env.BUCKET_S3_SERVER}`,
        ACCESS_KEY_ID : `${process.env.ACCESS_KEY_ID}`,
        ACCESS_KEY_SECRET : `${process.env.ACCESS_KEY_SECRET}`,
        MEDIA_BUCKET_NAME : `${process.env.MEDIA_BUCKET_NAME}`,
      },
    },
    {
      name: "handbook",
      script: "./node_modules/ep_etherpad-lite/node/server.js",
      env: {
        NODE_ENV: "production",
        PORT:`${process.env.PORT}`,
        DB_USER : `${process.env.DB_USER}`,
        DB_PASS : `${process.env.DB_PASS}`,
        DB_HOST : `${process.env.DB_HOST}`,
        DB_TYPE : `${process.env.DB_TYPE}`,
        DB_PORT : `${process.env.DB_PORT}`,
        DB_NAME : `${process.env.DB_NAME}`,
        BUCKET_S3_SERVER : `${process.env.BUCKET_S3_SERVER}`,
        ACCESS_KEY_ID : `${process.env.ACCESS_KEY_ID}`,
        ACCESS_KEY_SECRET : `${process.env.ACCESS_KEY_SECRET}`,
        MEDIA_BUCKET_NAME : `${process.env.MEDIA_BUCKET_NAME}`,
      },
    }

  ]
  }