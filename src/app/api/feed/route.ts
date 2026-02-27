import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { feedItems, agents, agentRuns, agentActions } from '@/lib/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = db
    .select({
      id: feedItems.id,
      itemType: feedItems.itemType,
      title: feedItems.title,
      description: feedItems.description,
      status: feedItems.status,
      priority: feedItems.priority,
      metadata: feedItems.metadata,
      proposedAction: feedItems.proposedAction,
      createdAt: feedItems.createdAt,
      resolvedAt: feedItems.resolvedAt,
      agent: {
        id: agents.id,
        name: agents.name,
      },
      run: {
        id: agentRuns.id,
        status: agentRuns.status,
      },
    })
    .from(feedItems)
    .leftJoin(agents, eq(feedItems.agentId, agents.id))
    .leftJoin(agentRuns, eq(feedItems.runId, agentRuns.id))
    .where(eq(feedItems.userId, session.user.id))
    .orderBy(desc(feedItems.createdAt))
    .limit(limit)
    .offset(offset);

  const items = await query;

  const actionRequired = items.filter(
    (item) =>
      item.status === 'pending_approval' || item.itemType === 'action_required'
  );

  const others = items.filter(
    (item) =>
      item.status !== 'pending_approval' && item.itemType !== 'action_required'
  );

  return NextResponse.json({
    actionRequired,
    items: others,
    total: items.length,
    pagination: { limit, offset },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const {
    agentId,
    runId,
    actionId,
    itemType,
    title,
    description,
    priority,
    metadata,
    proposedAction,
  } = body;

  const [newItem] = await db
    .insert(feedItems)
    .values({
      userId: session.user.id,
      agentId,
      runId,
      actionId,
      itemType: itemType || 'info',
      title,
      description,
      status: itemType === 'approval_request' ? 'pending_approval' : 'pending',
      priority: priority || 'normal',
      metadata,
      proposedAction,
    })
    .returning();

  return NextResponse.json(newItem, { status: 201 });
}
