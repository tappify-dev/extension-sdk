/* eslint-disable no-console */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export function createLogger(context: string) {
  const log = (
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    const entry: LogEntry = {
      level,
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };
    const output = formatLog(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      log('warn', message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      log('error', message, data),
  };
}
