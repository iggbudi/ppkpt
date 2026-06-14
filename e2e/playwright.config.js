const path = require('path');

module.exports = {
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3020',
    headless: true,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node index.js',
    cwd: path.join(__dirname, '..', 'server'),
    url: 'http://127.0.0.1:3020/api/health',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NODE_ENV: 'development',
      PORT: '3020',
      HOST: '127.0.0.1',
      SESSION_SECRET: 'e2e-session-secret-with-sufficient-entropy-32',
      ADMIN_USERNAME: 'e2eadmin',
      ADMIN_PASSWORD: 'e2e-admin-password-secure',
      REPORT_RATE_LIMIT_MAX: '100',
      EVIDENCE_UPLOADS_ENABLED: 'false'
    }
  }
};