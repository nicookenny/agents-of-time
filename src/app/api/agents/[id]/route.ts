import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { agents, agentTools, aiModels, tools as toolsTable } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth-helpers';

const updateAgentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  modelId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  runIntervalSeconds: z.number().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [agent] = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      systemPrompt: agents.systemPrompt,
      isActive: agents.isActive,
      requiresApproval: agents.requiresApproval,
      runIntervalSeconds: agents.runIntervalSeconds,
      lastRunAt: agents.lastRunAt,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      model: {
        id: aiModels.id,
        name: aiModels.name,
        modelIdentifier: aiModels.modelIdentifier,
      },
    })
    .from(agents)
    .leftJoin(aiModels, eq(agents.modelId, aiModels.id))
    .where(and(eq(agents.id, id), eq(agents.userId, session.user.id)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const tools = await db
    .select({
      id: toolsTable.id,
      name: toolsTable.name,
      identifier: toolsTable.identifier,
    })
    .from(agentTools)
    .leftJoin(toolsTable, eq(agentTools.toolId, toolsTable.id))
    .where(eq(agentTools.agentId, id));

  return NextResponse.json({ ...agent, tools });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, session.user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(agents)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, id), eq(agents.userId, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, session.user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  await db.delete(agents).where(and(eq(agents.id, id), eq(agents.userId, session.user.id)));

  return NextResponse.json({ success: true, deletedId: id });
}
