import { describe, expect, it } from 'vitest';
import { TAP_ENVIRONMENT_URLS, TapSdkError } from '../../src/types/common';

describe('TapSdkError', () => {
  it('constructs with code, message, statusCode, and details', () => {
    const error = new TapSdkError({
      code: 'TEST_ERROR',
      message: 'Something went wrong',
      statusCode: 400,
      details: { field: 'email' },
    });

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'email' });
  });

  it('extends Error', () => {
    const error = new TapSdkError({ code: 'ERR', message: 'fail' });
    expect(error).toBeInstanceOf(Error);
  });

  it('has name set to TapSdkError', () => {
    const error = new TapSdkError({ code: 'ERR', message: 'fail' });
    expect(error.name).toBe('TapSdkError');
  });

  it('allows optional statusCode and details', () => {
    const error = new TapSdkError({ code: 'ERR', message: 'fail' });
    expect(error.statusCode).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});

describe('TAP_ENVIRONMENT_URLS', () => {
  it('has development, staging, and production environments', () => {
    expect(Object.keys(TAP_ENVIRONMENT_URLS)).toEqual([
      'development',
      'staging',
      'production',
    ]);
  });

  it('each environment has api and app URLs', () => {
    for (const env of Object.values(TAP_ENVIRONMENT_URLS)) {
      expect(env).toHaveProperty('api');
      expect(env).toHaveProperty('app');
      expect(typeof env.api).toBe('string');
      expect(typeof env.app).toBe('string');
    }
  });

  it('development uses localhost URLs', () => {
    expect(TAP_ENVIRONMENT_URLS.development.api).toContain('localhost');
    expect(TAP_ENVIRONMENT_URLS.development.app).toContain('localhost');
  });

  it('production uses tap.security domain', () => {
    expect(TAP_ENVIRONMENT_URLS.production.api).toBe(
      'https://api.tap.security',
    );
    expect(TAP_ENVIRONMENT_URLS.production.app).toBe(
      'https://app.tap.security',
    );
  });
});
