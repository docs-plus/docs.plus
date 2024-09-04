const nextJest = require('next/jest')

// Create Next.js Jest config
const createJestConfig = nextJest({
  dir: './' // Path to the Next.js app
})

// Jest config options
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // Ensure this path is correct

  transform: {
    // Use babel-jest to transform js/ts files with the next/babel preset
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  moduleNameMapper: {
    // Handle module aliases (same as in next.config.js)
    '^@/components/(.*)$': './components/$1',
    '^@/pages/(.*)$': './pages/$1'
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'] // For custom Jest setup
}

// Export Jest config
module.exports = createJestConfig(customJestConfig)
