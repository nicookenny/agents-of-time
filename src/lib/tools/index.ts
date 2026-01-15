import { tool } from 'ai';
import { z } from 'zod';
import { gmailTools } from './gmail';
import { calendarTools } from './calendar';
import { bashTools } from './bash';
import { fileSystemTools } from './file-system';

export const allTools = {
  ...gmailTools,
  ...calendarTools,
  ...bashTools,
  ...fileSystemTools,
};

export type ToolIdentifier = keyof typeof allTools;

export function getToolsByIdentifiers(identifiers: string[]) {
  const result: Record<string, typeof allTools[ToolIdentifier]> = {};

  for (const id of identifiers) {
    if (id === 'gmail') {
      Object.assign(result, gmailTools);
    } else if (id === 'google_calendar') {
      Object.assign(result, calendarTools);
    } else if (id === 'bash') {
      Object.assign(result, bashTools);
    } else if (id === 'file_system' || id === 'file_reader' || id === 'file_writer') {
      Object.assign(result, fileSystemTools);
    }
  }

  return result;
}

export { gmailTools, calendarTools, bashTools, fileSystemTools };
