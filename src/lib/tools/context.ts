import { logger } from '@/lib/utils/logger';

let currentContext: Record<string, unknown> = {};

export function setToolContext(context: Record<string, unknown>) {
  logger.info('Setting tool context', {
    keys: Object.keys(context).join(','),
    userId: context.userId as string | undefined,
    agentId: context.agentId as string | undefined,
  });
  currentContext = context;
}

export function getToolContext<T = Record<string, unknown>>(): T {
  logger.debug('Getting tool context', {
    keys: Object.keys(currentContext).join(','),
    userId: currentContext.userId as string | undefined,
  });
  return currentContext as T;
}

export function clearToolContext() {
  logger.debug('Clearing tool context', {});
  currentContext = {};
}
