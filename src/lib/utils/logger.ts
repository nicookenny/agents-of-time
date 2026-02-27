type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  agentId?: string;
  runId?: string;
  tool?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}${ctx}`);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),
};
