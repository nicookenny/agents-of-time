import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chatConversations, agents } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';

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

  const conversations = await db
    .select()
    .from(chatConversations)
    .where(and(eq(chatConversations.agentId, agentId), eq(chatConversations.userId, session.user.id)))
    .orderBy(desc(chatConversations.updatedAt));

  return NextResponse.json(conversations);
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

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, session.user.id)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const [conversation] = await db
    .insert(chatConversations)
    .values({
      agentId,
      userId: session.user.id,
      title: body.title || 'New conversation',
    })
    .returning();

  return NextResponse.json(conversation, { status: 201 });
}
