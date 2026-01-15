import { tool } from 'ai';
import { z } from 'zod';
import { google } from 'googleapis';
import { getToolContext } from './context';

export interface CalendarContext {
  accessToken: string;
}

async function getCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export const calendarTools = {
  listEvents: tool({
    description: 'List calendar events within a time range',
    inputSchema: z.object({
      calendarId: z.string().default('primary').describe('Calendar ID'),
      timeMin: z.string().optional().describe('Start time (ISO 8601)'),
      timeMax: z.string().optional().describe('End time (ISO 8601)'),
      maxResults: z.number().default(10).describe('Maximum events to return'),
      query: z.string().optional().describe('Search query'),
    }),
    execute: async ({ calendarId, timeMin, timeMax, maxResults, query }) => {
      const { accessToken } = getToolContext<CalendarContext>();
      if (!accessToken) {
        return { error: 'No Calendar access token available', events: [], total: 0 };
      }
      const calendar = await getCalendarClient(accessToken);

      const now = new Date();
      const defaultTimeMin = timeMin || now.toISOString();
      const defaultTimeMax =
        timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await calendar.events.list({
        calendarId,
        timeMin: defaultTimeMin,
        timeMax: defaultTimeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        q: query,
      });

      const events = (response.data.items || []).map((event) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        attendees: event.attendees?.map((a) => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
        })),
        hangoutLink: event.hangoutLink,
        status: event.status,
      }));

      return { events, total: events.length };
    },
  }),

  getEvent: tool({
    description: 'Get details of a specific calendar event',
    inputSchema: z.object({
      calendarId: z.string().default('primary').describe('Calendar ID'),
      eventId: z.string().describe('Event ID'),
    }),
    execute: async ({ calendarId, eventId }) => {
      const { accessToken } = getToolContext<CalendarContext>();
      if (!accessToken) {
        return { error: 'No Calendar access token available' };
      }
      const calendar = await getCalendarClient(accessToken);

      const response = await calendar.events.get({
        calendarId,
        eventId,
      });

      const event = response.data;
      return {
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        attendees: event.attendees,
        hangoutLink: event.hangoutLink,
        status: event.status,
        recurrence: event.recurrence,
        reminders: event.reminders,
      };
    },
  }),

  createEvent: tool({
    description: 'Create a new calendar event',
    inputSchema: z.object({
      calendarId: z.string().default('primary').describe('Calendar ID'),
      summary: z.string().describe('Event title'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Event location'),
      startDateTime: z.string().describe('Start time (ISO 8601)'),
      endDateTime: z.string().describe('End time (ISO 8601)'),
      attendees: z.array(z.string()).optional().describe('Attendee email addresses'),
      sendNotifications: z.boolean().default(true).describe('Send email notifications'),
    }),
    execute: async ({
      calendarId,
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      attendees,
      sendNotifications,
    }) => {
      const { accessToken } = getToolContext<CalendarContext>();
      if (!accessToken) {
        return { success: false, error: 'No Calendar access token available' };
      }
      const calendar = await getCalendarClient(accessToken);

      const response = await calendar.events.insert({
        calendarId,
        sendNotifications,
        requestBody: {
          summary,
          description,
          location,
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
          attendees: attendees?.map((email) => ({ email })),
        },
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
      };
    },
  }),

  updateEvent: tool({
    description: 'Update an existing calendar event',
    inputSchema: z.object({
      calendarId: z.string().default('primary').describe('Calendar ID'),
      eventId: z.string().describe('Event ID'),
      summary: z.string().optional().describe('New event title'),
      description: z.string().optional().describe('New description'),
      location: z.string().optional().describe('New location'),
      startDateTime: z.string().optional().describe('New start time'),
      endDateTime: z.string().optional().describe('New end time'),
      sendNotifications: z.boolean().default(true),
    }),
    execute: async ({
      calendarId,
      eventId,
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      sendNotifications,
    }) => {
      const { accessToken } = getToolContext<CalendarContext>();
      if (!accessToken) {
        return { success: false, error: 'No Calendar access token available' };
      }
      const calendar = await getCalendarClient(accessToken);

      const existing = await calendar.events.get({ calendarId, eventId });

      const response = await calendar.events.patch({
        calendarId,
        eventId,
        sendNotifications,
        requestBody: {
          summary: summary ?? existing.data.summary,
          description: description ?? existing.data.description,
          location: location ?? existing.data.location,
          start: startDateTime ? { dateTime: startDateTime } : existing.data.start,
          end: endDateTime ? { dateTime: endDateTime } : existing.data.end,
        },
      });

      return {
        success: true,
        eventId: response.data.id,
        updated: response.data.updated,
      };
    },
  }),

  deleteEvent: tool({
    description: 'Delete a calendar event',
    inputSchema: z.object({
      calendarId: z.string().default('primary').describe('Calendar ID'),
      eventId: z.string().describe('Event ID'),
      sendNotifications: z.boolean().default(true),
    }),
    execute: async ({ calendarId, eventId, sendNotifications }) => {
      const { accessToken } = getToolContext<CalendarContext>();
      if (!accessToken) {
        return { success: false, error: 'No Calendar access token available' };
      }
      const calendar = await getCalendarClient(accessToken);

      await calendar.events.delete({
        calendarId,
        eventId,
        sendNotifications,
      });

      return { success: true, deletedEventId: eventId };
    },
  }),

  getUpcomingEvents: tool({
    description: 'Get events happening in the next N minutes',
    inputSchema: z.object({
      calendarId: z.string().default('primary'),
      minutesAhead: z.number().default(60).describe('Look ahead time in minutes'),
    }),
    execute: async ({ calendarId, minutesAhead }) => {
      const { accessToken } = getToolContext<CalendarContext>();
      if (!accessToken) {
        return { error: 'No Calendar access token available', events: [], timeRange: null };
      }
      const calendar = await getCalendarClient(accessToken);

      const now = new Date();
      const future = new Date(now.getTime() + minutesAhead * 60 * 1000);

      const response = await calendar.events.list({
        calendarId,
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = (response.data.items || []).map((event) => {
        const startTime = new Date(event.start?.dateTime || event.start?.date || '');
        const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / 60000);

        return {
          id: event.id,
          summary: event.summary,
          location: event.location,
          start: event.start?.dateTime || event.start?.date,
          minutesUntil,
          attendees: event.attendees?.length || 0,
          hangoutLink: event.hangoutLink,
        };
      });

      return { events, timeRange: { from: now.toISOString(), to: future.toISOString() } };
    },
  }),
};
