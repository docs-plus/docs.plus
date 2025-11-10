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
    // Handle module aliases (same as in tsconfig.json)
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/components/pages/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@stores$': '<rootDir>/src/stores/index.ts',
    '^@types$': '<rootDir>/src/types/index.ts',
    '^@api$': '<rootDir>/src/api/index.ts',
    '^@config$': '<rootDir>/src/config/index.ts',
    '^@helpers$': '<rootDir>/src/lib/helpers/index.ts'
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'] // For custom Jest setup
}

// Export Jest config
module.exports = createJestConfig(customJestConfig)
