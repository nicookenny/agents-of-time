import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  if (!settings) {
    return NextResponse.json({
      aiProvider: 'cloud',
      cloudModel: 'claude-3-5-haiku-20241022',
      ollamaModel: 'llama3.2:3b',
    });
  }

  return NextResponse.json({
    aiProvider: settings.aiProvider,
    cloudModel: settings.cloudModel,
    ollamaModel: settings.ollamaModel,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { aiProvider, cloudModel, ollamaModel } = body;

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  if (existing) {
    await db
      .update(userSettings)
      .set({
        aiProvider,
        cloudModel,
        ollamaModel,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, session.user.id));
  } else {
    await db.insert(userSettings).values({
      userId: session.user.id,
      aiProvider,
      cloudModel,
      ollamaModel,
    });
  }

  return NextResponse.json({ success: true });
}
