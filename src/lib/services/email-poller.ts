import { db } from '@/lib/db/client';
import { connectedAccounts, processedEmails, oauthProviders, agentConnectedAccounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getGmailClient, refreshAccessToken } from '@/lib/tools/gmail-helper';
import { emailProcessor } from './email-processor';
import { triggerAgent } from '@/lib/agents/runner';
import { logger } from '@/lib/utils/logger';

interface PollResult {
  accountId: string;
  accountEmail: string;
  emailsProcessed: number;
  agentsTriggered: number;
  error?: string;
}

export class EmailPollerService {
  async pollAllAccounts(): Promise<{ results: PollResult[]; totalProcessed: number; totalAgents: number }> {
    const gmailProvider = await db
      .select()
      .from(oauthProviders)
      .where(eq(oauthProviders.name, 'gmail'))
      .limit(1);

    if (gmailProvider.length === 0) {
      logger.warn('No Gmail provider configured');
      return { results: [], totalProcessed: 0, totalAgents: 0 };
    }

    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.providerId, gmailProvider[0].id),
          eq(connectedAccounts.isActive, true)
        )
      );

    if (accounts.length === 0) {
      return { results: [], totalProcessed: 0, totalAgents: 0 };
    }

    logger.info('Polling Gmail accounts', { accountCount: accounts.length });

    const results: PollResult[] = [];
    let totalProcessed = 0;
    let totalAgents = 0;

    for (const account of accounts) {
      const result = await this.pollAccount(account);
      results.push(result);
      totalProcessed += result.emailsProcessed;
      totalAgents += result.agentsTriggered;
    }

    return { results, totalProcessed, totalAgents };
  }

  async pollAccount(account: typeof connectedAccounts.$inferSelect): Promise<PollResult> {
    const result: PollResult = {
      accountId: account.id,
      accountEmail: account.accountEmail || account.accountIdentifier,
      emailsProcessed: 0,
      agentsTriggered: 0,
    };

    try {
      let accessToken = account.accessToken;
      const tokenExpiresAt = account.tokenExpiresAt;

      if (tokenExpiresAt && tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
        logger.info('Token expiring, attempting refresh', { accountId: account.id, accountEmail: result.accountEmail });

        if (!account.refreshToken) {
          result.error = 'Token expired and no refresh token available';
          logger.error('Token refresh failed - no refresh token', { accountId: account.id });
          await this.updateAccountError(account.id, result.error);
          return result;
        }

        try {
          const tokens = await refreshAccessToken(account.refreshToken);
          accessToken = tokens.accessToken;

          await db
            .update(connectedAccounts)
            .set({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken || account.refreshToken,
              tokenExpiresAt: tokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(connectedAccounts.id, account.id));

          logger.info('Token refreshed successfully', { accountId: account.id });
        } catch (refreshError: any) {
          result.error = `Token refresh failed: ${refreshError.message}`;
          logger.error('Token refresh failed', { accountId: account.id, error: refreshError.message });
          await this.updateAccountError(account.id, result.error);
          return result;
        }
      }

      const gmail = await getGmailClient(accessToken);

      const lastPolledAt = account.lastPolledAt;
      const afterEpoch = lastPolledAt
        ? Math.floor(lastPolledAt.getTime() / 1000)
        : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

      const query = `is:unread after:${afterEpoch}`;

      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      const messages = messagesResponse.data.messages || [];

      if (messages.length === 0) {
        await this.updateAccountLastPolled(account.id);
        return result;
      }

      logger.info('Found unread emails', { accountId: account.id, accountEmail: result.accountEmail, messageCount: messages.length });

      for (const msg of messages) {
        if (!msg.id) continue;

        const existing = await db
          .select({ id: processedEmails.id })
          .from(processedEmails)
          .where(eq(processedEmails.messageId, msg.id))
          .limit(1);

        if (existing.length > 0) {
          continue;
        }

        try {
          await emailProcessor.processEmailById(msg.id, accessToken, account.id);
          result.emailsProcessed++;
        } catch (err: any) {
          logger.error('Failed to process email', { accountId: account.id, messageId: msg.id, error: err.message });
        }
      }

      await this.updateAccountLastPolled(account.id);

      const triggeredCount = await this.triggerAgentsForAccount(account.id);
      result.agentsTriggered = triggeredCount;

      return result;
    } catch (error: any) {
      result.error = error.message;
      await this.updateAccountError(account.id, error.message);
      logger.error('Error polling account', { accountId: account.id, accountEmail: result.accountEmail, error: error.message });
      return result;
    }
  }

  private async triggerAgentsForAccount(accountId: string): Promise<number> {
    const linkedAgents = await db
      .select({ agentId: agentConnectedAccounts.agentId })
      .from(agentConnectedAccounts)
      .where(eq(agentConnectedAccounts.connectedAccountId, accountId));

    const uniqueAgentIds = [...new Set(linkedAgents.map(a => a.agentId))];

    let triggered = 0;
    for (const agentId of uniqueAgentIds) {
      try {
        logger.info('Triggering agent from email poll', { agentId, accountId });
        await triggerAgent(agentId, 'event', { source: 'email_poll', payload: { accountId } });
        triggered++;
      } catch (err: any) {
        logger.error('Failed to trigger agent', { agentId, accountId, error: err.message });
      }
    }

    return triggered;
  }

  private async updateAccountLastPolled(accountId: string): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({
        lastPolledAt: new Date(),
        lastPollError: null,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, accountId));
  }

  private async updateAccountError(accountId: string, error: string): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({
        lastPollError: error,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, accountId));
  }
}

export const emailPoller = new EmailPollerService();
