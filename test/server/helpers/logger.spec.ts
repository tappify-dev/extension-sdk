import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../../src/server/helpers/logger';

describe('createLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an object with debug, info, warn, error methods', () => {
    const logger = createLogger('test');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('debug outputs JSON with correct level, message, context, and timestamp', () => {
    const logger = createLogger('TestCtx');
    logger.debug('debug message');

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.level).toBe('debug');
    expect(output.message).toBe('debug message');
    expect(output.context).toBe('TestCtx');
    expect(output.timestamp).toBeDefined();
  });

  it('info uses console.log', () => {
    const logger = createLogger('ctx');
    logger.info('info message');

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
  });

  it('warn uses console.warn', () => {
    const logger = createLogger('ctx');
    logger.warn('warning');

    expect(warnSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(output.level).toBe('warn');
  });

  it('error uses console.error', () => {
    const logger = createLogger('ctx');
    logger.error('failure');

    expect(errorSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(output.level).toBe('error');
  });

  it('includes optional data field when passed', () => {
    const logger = createLogger('ctx');
    logger.info('with data', { userId: '123', action: 'login' });

    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.data).toEqual({ userId: '123', action: 'login' });
  });

  it('omits data field when not passed', () => {
    const logger = createLogger('ctx');
    logger.info('no data');

    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output.data).toBeUndefined();
  });
});
