import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { connectedAccounts, oauthProviders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
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
    .leftJoin(oauthProviders, eq(connectedAccounts.providerId, oauthProviders.id));

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
