import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { flows, agents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth-helpers';

const createFlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  schedule: z.string().min(1),
  actionDescription: z.string().min(1),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, session.user.id)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const agentFlows = await db
    .select()
    .from(flows)
    .where(and(eq(flows.agentId, agentId), eq(flows.userId, session.user.id)));

  return NextResponse.json(agentFlows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;
  const body = await req.json();

  const parsed = createFlowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, session.user.id)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const [flow] = await db
    .insert(flows)
    .values({
      agentId,
      userId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      schedule: parsed.data.schedule,
      actionDescription: parsed.data.actionDescription,
      status: 'active',
    })
    .returning();

  try {
    const { createSchedule } = await import('@/lib/trigger/client');
    const triggerJob = await createSchedule({
      id: flow.id,
      cron: flow.schedule,
      externalId: flow.id,
    });

    await db
      .update(flows)
      .set({ triggerJobId: triggerJob.id })
      .where(eq(flows.id, flow.id));

    flow.triggerJobId = triggerJob.id;
  } catch (error) {
    console.error('Failed to register flow with Trigger.dev:', error);
  }

  return NextResponse.json(flow, { status: 201 });
}
