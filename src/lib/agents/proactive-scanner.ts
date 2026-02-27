import { db } from '@/lib/db/client';
import {
  agents,
  agentConnectedAccounts,
  connectedAccounts,
  tools,
  agentRuns,
} from '@/lib/db/schema';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import { google } from 'googleapis';
import { triggerAgent } from './runner';

interface UpcomingMeeting {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  attendees: number;
  hangoutLink?: string;
  accountEmail: string;
}

async function getUpcomingMeetings(
  minutesAhead: number
): Promise<UpcomingMeeting[]> {
  const [calendarTool] = await db
    .select()
    .from(tools)
    .where(eq(tools.identifier, 'calendar'))
    .limit(1);

  if (!calendarTool) return [];

  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.isActive, true));

  const meetings: UpcomingMeeting[] = [];
  const now = new Date();
  const future = new Date(now.getTime() + minutesAhead * 60 * 1000);

  for (const account of accounts) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: account.accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      for (const event of events) {
        if (!event.start?.dateTime) continue;

        meetings.push({
          id: event.id!,
          summary: event.summary || 'Untitled',
          start: new Date(event.start.dateTime),
          end: new Date(event.end?.dateTime || event.start.dateTime),
          attendees: event.attendees?.length || 0,
          hangoutLink: event.hangoutLink || undefined,
          accountEmail: account.accountEmail || '',
        });
      }
    } catch (err) {
      console.error(`Failed to fetch calendar for ${account.accountEmail}:`, err);
    }
  }

  return meetings;
}

async function getAgentsForCalendarEvent(
  meeting: UpcomingMeeting
): Promise<string[]> {
  const [calendarTool] = await db
    .select()
    .from(tools)
    .where(eq(tools.identifier, 'calendar'))
    .limit(1);

  if (!calendarTool) return [];

  const account = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.accountEmail, meeting.accountEmail))
    .limit(1);

  if (!account.length) return [];

  const agentAccounts = await db
    .select({
      agentId: agentConnectedAccounts.agentId,
      isActive: agents.isActive,
    })
    .from(agentConnectedAccounts)
    .leftJoin(agents, eq(agentConnectedAccounts.agentId, agents.id))
    .where(
      and(
        eq(agentConnectedAccounts.connectedAccountId, account[0].id),
        eq(agentConnectedAccounts.toolId, calendarTool.id)
      )
    );

  return agentAccounts
    .filter((a) => a.isActive)
    .map((a) => a.agentId!)
    .filter(Boolean);
}

async function hasRecentRunForEvent(
  agentId: string,
  eventId: string,
  windowMinutes: number = 30
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

  const recentRuns = await db
    .select()
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.agentId, agentId),
        gt(agentRuns.startedAt, cutoff),
        eq(agentRuns.triggerType, 'scheduled')
      )
    )
    .limit(1);

  return recentRuns.length > 0;
}

export async function scanForProactiveActions() {
  console.log('Running proactive scanner...');

  const upcomingMeetings = await getUpcomingMeetings(120);
  console.log(`Found ${upcomingMeetings.length} upcoming meetings`);

  const triggeredAgents: string[] = [];

  for (const meeting of upcomingMeetings) {
    const minutesUntil = Math.round(
      (meeting.start.getTime() - Date.now()) / 60000
    );

    if (minutesUntil > 60 || minutesUntil < 5) continue;

    const agentIds = await getAgentsForCalendarEvent(meeting);

    for (const agentId of agentIds) {
      const hasRecent = await hasRecentRunForEvent(agentId, meeting.id);
      if (hasRecent) continue;

      try {
        await triggerAgent(agentId, 'scheduled', {
          source: 'proactive_calendar',
          event: {
            id: meeting.id,
            summary: meeting.summary,
            start: meeting.start.toISOString(),
            end: meeting.end.toISOString(),
            attendees: meeting.attendees,
            hangoutLink: meeting.hangoutLink,
          },
          minutesUntil,
        });
        triggeredAgents.push(agentId);
      } catch (err) {
        console.error(`Failed to trigger agent ${agentId}:`, err);
      }
    }
  }

  console.log(`Proactive scanner triggered ${triggeredAgents.length} agents`);
  return { triggered: triggeredAgents.length };
}

export async function runScheduledAgents() {
  const now = new Date();

  const dueAgents = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.isActive, true),
        or(
          isNull(agents.lastRunAt),
          gt(
            agents.runIntervalSeconds,
            0
          )
        )
      )
    );

  const triggeredAgents: string[] = [];

  for (const agent of dueAgents) {
    if (!agent.runIntervalSeconds) continue;

    const lastRun = agent.lastRunAt?.getTime() || 0;
    const intervalMs = agent.runIntervalSeconds * 1000;
    const nextRunTime = lastRun + intervalMs;

    if (now.getTime() >= nextRunTime) {
      try {
        await triggerAgent(agent.id, 'scheduled', {
          source: 'interval',
          interval: agent.runIntervalSeconds,
        });
        triggeredAgents.push(agent.id);
      } catch (err) {
        console.error(`Failed to run scheduled agent ${agent.id}:`, err);
      }
    }
  }

  return { triggered: triggeredAgents.length };
}
