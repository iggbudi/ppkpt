const { spawnSync } = require('node:child_process');
const path = require('node:path');

const result = spawnSync(process.execPath, [path.join(__dirname, 'index.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development'
  }
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
