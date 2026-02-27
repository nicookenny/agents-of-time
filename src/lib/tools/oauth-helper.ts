import { db } from '@/lib/db/client';
import { connectedAccounts, oauthProviders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

export type ServiceType = 'gmail' | 'calendar';

export async function getUserOAuthToken(userId: string, providerName: 'Google', service: ServiceType) {
  logger.info('OAuth token request', { userId, provider: providerName, service });

  if (!userId) {
    logger.error('OAuth token request FAILED - no userId provided', { provider: providerName, service });
    return undefined;
  }

  const [provider] = await db
    .select({ id: oauthProviders.id, name: oauthProviders.name })
    .from(oauthProviders)
    .where(eq(oauthProviders.name, providerName))
    .limit(1);

  if (!provider) {
    logger.error('OAuth provider NOT FOUND in database', { provider: providerName, service });
    return undefined;
  }

  const [account] = await db
    .select({
      accessToken: connectedAccounts.accessToken,
      refreshToken: connectedAccounts.refreshToken,
    })
    .from(connectedAccounts)
    .where(and(
      eq(connectedAccounts.userId, userId),
      eq(connectedAccounts.providerId, provider.id),
      eq(connectedAccounts.serviceType, service),
      eq(connectedAccounts.isActive, true)
    ))
    .limit(1);

  if (!account) {
    logger.error('No connected account found', { userId, provider: providerName, service });
  } else {
    logger.info('OAuth token retrieved', { userId, service, hasToken: !!account.accessToken });
  }

  return account;
}
