import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (process.platform !== 'linux' || process.arch !== 'x64') {
  process.exit(0)
}

const installed = existsSync('node_modules/@rolldown/binding-linux-x64-gnu/package.json')
if (installed) process.exit(0)

execSync('npm install --no-save --include=optional @rolldown/binding-linux-x64-gnu@1.2.9', {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    NPM_CONFIG_PRODUCTION: 'false',
    npm_config_production: 'false',
  },
})
