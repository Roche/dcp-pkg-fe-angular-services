/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': ['ts-jest', {
      tsconfig: {
        // Relax options from the strict Angular tsconfig for Jest
        module: 'CommonJS',
        target: 'ES2017',
        types: ['jest'],
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
        strict: true,
        skipLibCheck: true,
      },
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Map ESM-only packages that don't ship CJS bundles
    '^@open-dcp/services$': '<rootDir>/projects/open-dcp/angular-services/node_modules/@open-dcp/services/dist/index.js',
  },
  transformIgnorePatterns: [
    // Do NOT ignore any .mjs files, @angular packages, @open-dcp, or ngx-permissions
    'node_modules/(?!.*\\.mjs$|@angular|@open-dcp|ngx-permissions)',
  ],
};

