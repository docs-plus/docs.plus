module.exports = {
  apps: [
    {
      name: "etherpad",
      script: "node_modules/ep_etherpad-lite/node/server.js",
      watch: false,
    },
    {
      name: "ws_master",
      script: "ws.router/server/index.pm2.cluster.js",
      instances: 1,
      watch: false,
      restart_delay: 30000,
      exec_mode: "cluster",
      env: {
        PORT: 3000,
      },
    },
    {
      name: "ws_dev",
      script: "ws.router/server/index.pm2.cluster.js",
      instances: 1,
      watch: false,
      restart_delay: 30000,
      exec_mode: "cluster",
      env: {
        PORT: 8000,
      },
    },
    {
      name: "ws_democracy",
      script: "ws.router/server/index.pm2.cluster.js",
      instances: 1,
      watch: false,
      restart_delay: 30000,
      exec_mode: "cluster",
      env: {
        PORT: 8001,
      },
    },
  ],
};
