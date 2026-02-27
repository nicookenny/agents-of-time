import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { connectedAccounts, oauthProviders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTokensFromCode, getUserInfo, getRedirectUri } from '@/lib/oauth/google';
import { getServerSession } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  const url = new URL(req.url);

  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL('/accounts?error=not_authenticated', url.origin));
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(error)}`, url.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/accounts?error=no_code', url.origin));
  }

  try {
    const redirectUri = getRedirectUri('calendar');
    const tokens = await getTokensFromCode(code, redirectUri);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    const userInfo = await getUserInfo(tokens.access_token);

    const [googleProvider] = await db
      .select()
      .from(oauthProviders)
      .where(eq(oauthProviders.name, 'Google'))
      .limit(1);

    if (!googleProvider) {
      throw new Error('Google OAuth provider not found in database');
    }

    const existingAccount = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, session.user.id),
          eq(connectedAccounts.providerId, googleProvider.id),
          eq(connectedAccounts.accountIdentifier, userInfo.id!),
          eq(connectedAccounts.serviceType, 'calendar')
        )
      )
      .limit(1);

    const calendarScopes = [
      'calendar',
      'calendar.events',
      'userinfo.email',
      'userinfo.profile',
    ];

    if (existingAccount.length > 0) {
      const existingScopes = existingAccount[0].scopesGranted || [];
      const mergedScopes = [...new Set([...existingScopes, ...calendarScopes])];

      await db
        .update(connectedAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existingAccount[0].refreshToken,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          accountEmail: userInfo.email,
          accountName: userInfo.name,
          scopesGranted: mergedScopes,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, existingAccount[0].id));
    } else {
      await db.insert(connectedAccounts).values({
        userId: session.user.id,
        providerId: googleProvider.id,
        accountIdentifier: userInfo.id!,
        serviceType: 'calendar',
        accountEmail: userInfo.email,
        accountName: userInfo.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopesGranted: calendarScopes,
        isActive: true,
      });
    }

    return NextResponse.redirect(new URL('/accounts?success=calendar_connected', url.origin));
  } catch (err: any) {
    console.error('Calendar OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(err.message)}`, url.origin)
    );
  }
}
