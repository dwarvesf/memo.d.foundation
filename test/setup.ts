/**
 * Jest setup file
 * Configures global test environment and utilities
 */

import { jest } from '@jest/globals';

// Set longer timeout for DuckDB operations
jest.setTimeout(30000);

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
  const testUtils: Record<string, unknown>;
}

globalThis.testUtils = {
  // Add any global test utilities here
};
