/** Jest config — runs against a dedicated SQLite file (prisma/test.db) created by globalSetup. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: { warnOnly: true } }],
  },
};
