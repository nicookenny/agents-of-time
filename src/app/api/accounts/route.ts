import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { connectedAccounts, oauthProviders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accounts = await db
    .select({
      id: connectedAccounts.id,
      accountEmail: connectedAccounts.accountEmail,
      accountName: connectedAccounts.accountName,
      scopesGranted: connectedAccounts.scopesGranted,
      isActive: connectedAccounts.isActive,
      tokenExpiresAt: connectedAccounts.tokenExpiresAt,
      createdAt: connectedAccounts.createdAt,
      updatedAt: connectedAccounts.updatedAt,
      provider: {
        id: oauthProviders.id,
        name: oauthProviders.name,
      },
    })
    .from(connectedAccounts)
    .leftJoin(oauthProviders, eq(connectedAccounts.providerId, oauthProviders.id))
    .where(eq(connectedAccounts.userId, session.user.id));

  const accountsWithStatus = accounts.map((acc) => {
    const needsReauth =
      acc.tokenExpiresAt && new Date(acc.tokenExpiresAt) < new Date();
    return {
      ...acc,
      status: needsReauth ? 'needs_reauth' : acc.isActive ? 'active' : 'inactive',
    };
  });

  return NextResponse.json(accountsWithStatus);
}
