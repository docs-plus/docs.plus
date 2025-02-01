require('dotenv').config()

module.exports = {
  serverUrl: process.env.NEXT_PUBLIC_ELASTIC_APM_SERVER_URL,
  secretToken: process.env.NEXT_PUBLIC_ELASTIC_APM_SECRET_TOKEN,
  serviceName: 'webapp_amp',
  verifyServerCert: false,
  environment: process.env.NODE_ENV,
  captureBody: 'all',
  captureHeaders: true,
  serverTimeout: 30000
}
