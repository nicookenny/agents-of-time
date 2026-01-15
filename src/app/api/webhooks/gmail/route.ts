import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import {
  connectedAccounts,
  agentConnectedAccounts,
  agents,
  tools,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { triggerAgent } from '@/lib/agents/runner';

interface GmailPushNotification {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

function decodeGmailNotification(data: string): { emailAddress: string; historyId: string } {
  const decoded = Buffer.from(data, 'base64').toString('utf-8');
  const parsed = JSON.parse(decoded);
  return {
    emailAddress: parsed.emailAddress,
    historyId: parsed.historyId,
  };
}

export async function POST(req: Request) {
  try {
    const body: GmailPushNotification = await req.json();

    if (!body.message?.data) {
      return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
    }

    const { emailAddress, historyId } = decodeGmailNotification(body.message.data);

    const account = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.accountEmail, emailAddress))
      .limit(1);

    if (!account.length) {
      return NextResponse.json({ status: 'no_account' });
    }

    const [gmailTool] = await db
      .select()
      .from(tools)
      .where(eq(tools.identifier, 'gmail'))
      .limit(1);

    if (!gmailTool) {
      return NextResponse.json({ status: 'no_gmail_tool' });
    }

    const agentAccounts = await db
      .select({
        agentId: agentConnectedAccounts.agentId,
        agentName: agents.name,
        isActive: agents.isActive,
      })
      .from(agentConnectedAccounts)
      .leftJoin(agents, eq(agentConnectedAccounts.agentId, agents.id))
      .where(
        and(
          eq(agentConnectedAccounts.connectedAccountId, account[0].id),
          eq(agentConnectedAccounts.toolId, gmailTool.id)
        )
      );

    const activeAgents = agentAccounts.filter((a) => a.isActive);

    const results = await Promise.all(
      activeAgents.map((agent) =>
        triggerAgent(agent.agentId!, 'event', {
          source: 'gmail',
          historyId,
          emailAddress,
        })
      )
    );

    return NextResponse.json({
      status: 'processed',
      agentsTriggered: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Gmail webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Gmail webhook endpoint active' });
}
