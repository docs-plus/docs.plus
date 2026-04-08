/**
 * Self-contained Jest config for this package. Jest deps stay on the repo root only.
 * If a second library package adds Jest, consider extracting a shared preset again.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript'
        ]
      }
    ]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json']
}
