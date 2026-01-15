import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { connectedAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revokeToken } from '@/lib/oauth/google';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, id))
    .limit(1);

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, id))
    .limit(1);

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  try {
    if (account.accessToken) {
      await revokeToken(account.accessToken);
    }
  } catch (err) {
  }

  await db.delete(connectedAccounts).where(eq(connectedAccounts.id, id));

  return NextResponse.json({ success: true, deletedId: id });
}
