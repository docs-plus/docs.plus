module.exports = {
  serverUrl: process.env.ELASTIC_APM_SERVER_URL,
  secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
  serviceName: 'webapp_amp',
  verifyServerCert: false,
  environment: process.env.NODE_ENV,
  captureBody: 'all',
  captureHeaders: true,
  serverTimeout: 30000
}
