import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { feedItems, approvalLogs, agentActions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [item] = await db
    .select()
    .from(feedItems)
    .where(eq(feedItems.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: 'Feed item not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { action, reason, modifications } = body;

  const [item] = await db
    .select()
    .from(feedItems)
    .where(eq(feedItems.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: 'Feed item not found' }, { status: 404 });
  }

  let newStatus: 'approved' | 'rejected' | 'completed' | 'dismissed';

  switch (action) {
    case 'approve':
      newStatus = 'approved';
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'dismiss':
      newStatus = 'dismissed';
      break;
    case 'complete':
      newStatus = 'completed';
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const [updatedItem] = await db
    .update(feedItems)
    .set({
      status: newStatus,
      resolvedAt: new Date(),
    })
    .where(eq(feedItems.id, id))
    .returning();

  await db.insert(approvalLogs).values({
    feedItemId: id,
    actionId: item.actionId,
    decision: action,
    reason,
    modifications,
  });

  if (item.actionId && (action === 'approve' || action === 'reject')) {
    await db
      .update(agentActions)
      .set({
        status: action === 'approve' ? 'approved' : 'rejected',
      })
      .where(eq(agentActions.id, item.actionId));
  }

  return NextResponse.json(updatedItem);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.delete(feedItems).where(eq(feedItems.id, id));

  return NextResponse.json({ success: true });
}
