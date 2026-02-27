import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import {
  connectedAccounts,
  agentConnectedAccounts,
  agents,
  tools,
  eventLogs,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { triggerAgent } from '@/lib/agents/runner';

export async function POST(req: Request) {
  try {
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const channelToken = req.headers.get('x-goog-channel-token');

    if (resourceState === 'sync') {
      return NextResponse.json({ status: 'sync_acknowledged' });
    }

    await db.insert(eventLogs).values({
      eventType: 'calendar_webhook',
      sourceType: 'google_calendar',
      payload: {
        channelId,
        resourceId,
        resourceState,
        channelToken,
      },
      processed: false,
    });

    const [calendarTool] = await db
      .select()
      .from(tools)
      .where(eq(tools.identifier, 'calendar'))
      .limit(1);

    if (!calendarTool) {
      return NextResponse.json({ status: 'no_calendar_tool' });
    }

    const agentAccounts = await db
      .select({
        agentId: agentConnectedAccounts.agentId,
        agentName: agents.name,
        isActive: agents.isActive,
        accountId: agentConnectedAccounts.connectedAccountId,
      })
      .from(agentConnectedAccounts)
      .leftJoin(agents, eq(agentConnectedAccounts.agentId, agents.id))
      .where(eq(agentConnectedAccounts.toolId, calendarTool.id));

    const activeAgents = agentAccounts.filter((a) => a.isActive);

    const results = await Promise.all(
      activeAgents.map((agent) =>
        triggerAgent(agent.agentId!, 'event', {
          source: 'calendar',
          resourceId: resourceId || undefined,
          resourceState: resourceState || undefined,
          channelId: channelId || undefined,
        })
      )
    );

    return NextResponse.json({
      status: 'processed',
      agentsTriggered: results.length,
    });
  } catch (error: any) {
    console.error('Calendar webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Calendar webhook endpoint active' });
}
