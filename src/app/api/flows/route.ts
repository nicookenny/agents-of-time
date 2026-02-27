import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { flows, agents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userFlows = await db
    .select({
      id: flows.id,
      name: flows.name,
      description: flows.description,
      schedule: flows.schedule,
      actionDescription: flows.actionDescription,
      status: flows.status,
      lastRunAt: flows.lastRunAt,
      nextRunAt: flows.nextRunAt,
      createdAt: flows.createdAt,
      agentId: flows.agentId,
      agent: {
        id: agents.id,
        name: agents.name,
      },
    })
    .from(flows)
    .leftJoin(agents, eq(flows.agentId, agents.id))
    .where(eq(flows.userId, session.user.id))
    .orderBy(desc(flows.createdAt));

  return NextResponse.json(userFlows);
}
