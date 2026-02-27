import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { conversationId } = await params;

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, session.user.id)
    ))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt));

  return NextResponse.json({ ...conversation, messages });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { conversationId } = await params;

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, session.user.id)
    ))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));

  return NextResponse.json({ success: true, deletedId: conversationId });
}
