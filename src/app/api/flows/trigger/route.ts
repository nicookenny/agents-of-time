import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { flows, agents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { triggerAgent } from '@/lib/agents/runner';
import { getServerSession } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { flowId, externalId } = body;

  const id = flowId || externalId;
  if (!id) {
    return NextResponse.json({ error: 'flowId or externalId required' }, { status: 400 });
  }

  const [flow] = await db
    .select()
    .from(flows)
    .where(and(eq(flows.id, id), eq(flows.userId, session.user.id)))
    .limit(1);

  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  if (flow.status !== 'active') {
    return NextResponse.json({ error: 'Flow is not active', status: flow.status }, { status: 400 });
  }

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, flow.agentId))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found for flow' }, { status: 404 });
  }

  const result = await triggerAgent(flow.agentId, 'scheduled', {
    source: 'flow',
    payload: {
      flowId: flow.id,
      flowName: flow.name,
      actionDescription: flow.actionDescription,
    },
  });

  await db
    .update(flows)
    .set({ lastRunAt: new Date() })
    .where(eq(flows.id, flow.id));

  return NextResponse.json({
    success: result.success,
    flowId: flow.id,
    runId: result.runId,
    error: result.error,
  });
}
