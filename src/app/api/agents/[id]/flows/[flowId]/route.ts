import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { flows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth-helpers';

const updateFlowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  schedule: z.string().optional(),
  actionDescription: z.string().optional(),
  status: z.enum(['active', 'paused', 'error']).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; flowId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { flowId } = await params;

  const [flow] = await db
    .select()
    .from(flows)
    .where(and(eq(flows.id, flowId), eq(flows.userId, session.user.id)))
    .limit(1);

  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  return NextResponse.json(flow);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; flowId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { flowId } = await params;
  const body = await req.json();

  const parsed = updateFlowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(flows)
    .where(and(eq(flows.id, flowId), eq(flows.userId, session.user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(flows)
    .set(parsed.data)
    .where(and(eq(flows.id, flowId), eq(flows.userId, session.user.id)))
    .returning();

  if (parsed.data.schedule && existing.triggerJobId) {
    try {
      const { updateSchedule } = await import('@/lib/trigger/client');
      await updateSchedule(existing.triggerJobId, { cron: parsed.data.schedule });
    } catch (error) {
      console.error('Failed to update Trigger.dev schedule:', error);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; flowId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { flowId } = await params;

  const [existing] = await db
    .select()
    .from(flows)
    .where(and(eq(flows.id, flowId), eq(flows.userId, session.user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  if (existing.triggerJobId) {
    try {
      const { deleteSchedule } = await import('@/lib/trigger/client');
      await deleteSchedule(existing.triggerJobId);
    } catch (error) {
      console.error('Failed to delete Trigger.dev schedule:', error);
    }
  }

  await db.delete(flows).where(and(eq(flows.id, flowId), eq(flows.userId, session.user.id)));

  return NextResponse.json({ success: true, deletedId: flowId });
}
