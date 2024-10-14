const { execSync } = require('child_process')

try {
  console.log('Running Next.js build...')
  execSync('cd packages/webapp && npm run build', { stdio: 'inherit' })
  console.log('Build successful. Proceeding with push.')
  process.exit(0)
} catch (error) {
  console.error('Build failed. Push aborted.')
  process.exit(1)
}
