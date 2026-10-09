import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Enables describe, it, expect globally without manual imports
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 10000,
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    clearMocks: true
  }
});