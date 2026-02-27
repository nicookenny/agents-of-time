import { tool } from 'ai';
import { z } from 'zod';
import { defaultTools } from './defaults';
import { gmailTools } from './gmail';
import { calendarTools } from './calendar';
import { bashTools } from './bash';
import { fileSystemTools } from './file-system';
import { flowTools } from './flows';

export const allTools = {
  ...defaultTools,
  ...gmailTools,
  ...calendarTools,
  ...bashTools,
  ...fileSystemTools,
  ...flowTools,
};

export type ToolIdentifier = keyof typeof allTools;

export function getToolsByIdentifiers(identifiers: string[], includeFlows = false) {
  const result: Record<string, typeof allTools[ToolIdentifier]> = {};

  // Always include default tools for all agents
  Object.assign(result, defaultTools);

  for (const id of identifiers) {
    if (id === 'gmail') {
      Object.assign(result, gmailTools);
    } else if (id === 'calendar') {
      Object.assign(result, calendarTools);
    } else if (id === 'bash') {
      Object.assign(result, bashTools);
    } else if (id === 'file_system' || id === 'file_reader' || id === 'file_writer') {
      Object.assign(result, fileSystemTools);
    }
  }

  if (includeFlows) {
    Object.assign(result, flowTools);
  }

  return result;
}

export { defaultTools, gmailTools, calendarTools, bashTools, fileSystemTools, flowTools };
