import { describe, expect, it } from 'vitest';
import { defineAppConfig, type TapAppConfig } from '../../src/types/app-config';

describe('defineAppConfig', () => {
  const config: TapAppConfig = {
    id: 'test-app',
    name: 'Test App',
    slug: 'test-app',
    description: 'A test application',
    type: 'appstore',
    auth: { method: 'jwt' },
    baseUrl: 'https://example.com',
  };

  it('returns the same object passed in', () => {
    const result = defineAppConfig(config);
    expect(result).toBe(config);
  });

  it('preserves all properties', () => {
    const result = defineAppConfig(config);
    expect(result).toEqual(config);
  });
});
