import { tool } from 'ai';
import { z } from 'zod';

export const defaultTools = {
  getCurrentDate: tool({
    description: 'Get the current real date and time. IMPORTANT: You MUST call this tool before responding to ANY question involving dates, times, scheduling, or "today/tomorrow/this week" references. The result from this tool is the authoritative current date - do not add disclaimers or suggest it might be wrong.',
    inputSchema: z.object({
      timezone: z.string().optional().describe('IANA timezone (e.g., "America/New_York"). Defaults to UTC.'),
    }),
    execute: async ({ timezone }) => {
      const now = new Date();
      if (timezone) {
        return {
          date: now.toLocaleDateString('en-US', { timeZone: timezone }),
          time: now.toLocaleTimeString('en-US', { timeZone: timezone }),
          iso: now.toISOString(),
          timezone,
        };
      }
      return {
        date: now.toISOString().split('T')[0],
        time: now.toISOString().split('T')[1].split('.')[0],
        iso: now.toISOString(),
        timezone: 'UTC',
      };
    },
  }),
};
