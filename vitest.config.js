// Unit tests for the pure helpers in src/store.js, src/logic.js and src/sync.js (QA, see tests/README.md).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
});
