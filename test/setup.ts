/**
 * Jest setup file
 * Configures global test environment and utilities
 */

import { vi } from 'vitest';

// Set longer timeout for DuckDB operations
vi.setConfig({ testTimeout: 30000 });

// Mock environment variables for tests
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: false,
    enumerable: true,
    configurable: true,
  });
}

// Global test utilities
declare global {
  interface globalThis {
    testUtils: Record<string, unknown>;
  }
}

Object.assign(globalThis, {
  testUtils: {
    // Add any global test utilities here
  },
});
