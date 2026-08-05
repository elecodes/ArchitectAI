import { pino, stdTimeFunctions } from 'pino';

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  timestamp: stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
});

export function createChildLogger(module: string) {
  return logger.child({ module });
}
