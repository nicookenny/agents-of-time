import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './context';
import { getGmailClient } from './gmail-helper';
import { getUserOAuthToken } from './oauth-helper';
import { logger } from '@/lib/utils/logger';

export interface ToolContext {
  userId: string;
}

export const gmailTools = {
  listEmails: tool({
    description: 'List emails from Gmail inbox with optional filtering',
    inputSchema: z.object({
      query: z.string().optional().describe('Gmail search query (e.g., "is:unread", "from:someone@email.com")'),
      maxResults: z.number().default(10).describe('Maximum number of emails to return'),
      labelIds: z.array(z.string()).optional().describe('Filter by label IDs'),
    }),
    execute: async ({ query, maxResults, labelIds }) => {
      const { userId } = getToolContext<ToolContext>();

      if (!userId) {
        logger.warn('Gmail auth missing', { tool: 'listEmails' });
        return { error: 'No user context available', emails: [], total: 0 };
      }

      const tokens = await getUserOAuthToken(userId, 'Google', 'gmail');
      logger.debug('Gmail API call', { tool: 'listEmails', hasToken: !!tokens, query });

      if (!tokens) {
        logger.warn('Gmail auth missing', { tool: 'listEmails' });
        return { error: 'No Gmail account connected', emails: [], total: 0 };
      }

      try {
        const gmail = await getGmailClient(tokens.accessToken, tokens.refreshToken ?? undefined);

        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
          labelIds,
        });

        const messages = response.data.messages || [];
        logger.debug('Gmail listEmails response', { tool: 'listEmails', messageCount: messages.length });

        const emailDetails = await Promise.all(
          messages.slice(0, maxResults).map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            });

            const headers = detail.data.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            return {
              id: msg.id,
              threadId: msg.threadId,
              from: getHeader('from'),
              to: getHeader('to'),
              subject: getHeader('subject'),
              date: getHeader('date'),
              snippet: detail.data.snippet,
              labelIds: detail.data.labelIds,
            };
          })
        );

        return { emails: emailDetails, total: response.data.resultSizeEstimate };
      } catch (error: any) {
        logger.error('Gmail API error', { tool: 'listEmails', error: error.message, status: error.status });
        return { error: error.message, emails: [], total: 0 };
      }
    },
  }),

  readEmail: tool({
    description: 'Read the full content of a specific email',
    inputSchema: z.object({
      messageId: z.string().describe('The Gmail message ID'),
    }),
    execute: async ({ messageId }) => {
      const { userId } = getToolContext<ToolContext>();

      if (!userId) {
        logger.warn('Gmail auth missing', { tool: 'readEmail' });
        return { error: 'No user context available' };
      }

      const tokens = await getUserOAuthToken(userId, 'Google', 'gmail');
      logger.debug('Gmail API call', { tool: 'readEmail', hasToken: !!tokens, messageId });

      if (!tokens) {
        logger.warn('Gmail auth missing', { tool: 'readEmail' });
        return { error: 'No Gmail account connected' };
      }

      try {
        const gmail = await getGmailClient(tokens.accessToken, tokens.refreshToken ?? undefined);

        const response = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const headers = response.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        let body = '';
        const payload = response.data.payload;

        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          const textPart = payload.parts.find(
            (p) => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
          );
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        logger.debug('Gmail readEmail response', { tool: 'readEmail', messageId, hasBody: !!body });

        return {
          id: messageId,
          from: getHeader('from'),
          to: getHeader('to'),
          subject: getHeader('subject'),
          date: getHeader('date'),
          body,
          labelIds: response.data.labelIds,
        };
      } catch (error: any) {
        logger.error('Gmail API error', { tool: 'readEmail', error: error.message, status: error.status, messageId });
        return { error: error.message };
      }
    },
  }),

  sendEmail: tool({
    description: 'Send an email via Gmail',
    inputSchema: z.object({
      to: z.string().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body (plain text)'),
      cc: z.string().optional().describe('CC recipients'),
      bcc: z.string().optional().describe('BCC recipients'),
    }),
    execute: async ({ to, subject, body, cc, bcc }) => {
      const { userId } = getToolContext<ToolContext>();

      if (!userId) {
        logger.warn('Gmail auth missing', { tool: 'sendEmail' });
        return { success: false, error: 'No user context available' };
      }

      const tokens = await getUserOAuthToken(userId, 'Google', 'gmail');
      logger.debug('Gmail API call', { tool: 'sendEmail', hasToken: !!tokens, to, subject });

      if (!tokens) {
        logger.warn('Gmail auth missing', { tool: 'sendEmail' });
        return { success: false, error: 'No Gmail account connected' };
      }

      try {
        const gmail = await getGmailClient(tokens.accessToken, tokens.refreshToken ?? undefined);

        const emailLines = [
          `To: ${to}`,
          cc ? `Cc: ${cc}` : '',
          bcc ? `Bcc: ${bcc}` : '',
          'Content-Type: text/plain; charset=utf-8',
          'MIME-Version: 1.0',
          `Subject: ${subject}`,
          '',
          body,
        ].filter(Boolean);

        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail,
          },
        });

        logger.info('Gmail sendEmail success', { tool: 'sendEmail', messageId: response.data.id });

        return {
          success: true,
          messageId: response.data.id,
          threadId: response.data.threadId,
        };
      } catch (error: any) {
        logger.error('Gmail API error', { tool: 'sendEmail', error: error.message, status: error.status, to });
        return { success: false, error: error.message };
      }
    },
  }),

  modifyLabels: tool({
    description: 'Add or remove labels from an email',
    inputSchema: z.object({
      messageId: z.string().describe('The Gmail message ID'),
      addLabelIds: z.array(z.string()).optional().describe('Labels to add'),
      removeLabelIds: z.array(z.string()).optional().describe('Labels to remove'),
    }),
    execute: async ({ messageId, addLabelIds, removeLabelIds }) => {
      const { userId } = getToolContext<ToolContext>();

      if (!userId) {
        logger.warn('Gmail auth missing', { tool: 'modifyLabels' });
        return { success: false, error: 'No user context available' };
      }

      const tokens = await getUserOAuthToken(userId, 'Google', 'gmail');
      logger.debug('Gmail API call', { tool: 'modifyLabels', hasToken: !!tokens, messageId });

      if (!tokens) {
        logger.warn('Gmail auth missing', { tool: 'modifyLabels' });
        return { success: false, error: 'No Gmail account connected' };
      }

      try {
        const gmail = await getGmailClient(tokens.accessToken, tokens.refreshToken ?? undefined);

        const response = await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds,
            removeLabelIds,
          },
        });

        logger.debug('Gmail modifyLabels success', { tool: 'modifyLabels', messageId });

        return {
          success: true,
          messageId: response.data.id,
          labelIds: response.data.labelIds,
        };
      } catch (error: any) {
        logger.error('Gmail API error', { tool: 'modifyLabels', error: error.message, status: error.status, messageId });
        return { success: false, error: error.message };
      }
    },
  }),

  createDraft: tool({
    description: 'Create a draft email',
    inputSchema: z.object({
      to: z.string().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body'),
    }),
    execute: async ({ to, subject, body }) => {
      const { userId } = getToolContext<ToolContext>();

      if (!userId) {
        logger.warn('Gmail auth missing', { tool: 'createDraft' });
        return { success: false, error: 'No user context available' };
      }

      const tokens = await getUserOAuthToken(userId, 'Google', 'gmail');
      logger.debug('Gmail API call', { tool: 'createDraft', hasToken: !!tokens, to, subject });

      if (!tokens) {
        logger.warn('Gmail auth missing', { tool: 'createDraft' });
        return { success: false, error: 'No Gmail account connected' };
      }

      try {
        const gmail = await getGmailClient(tokens.accessToken, tokens.refreshToken ?? undefined);

        const emailLines = [
          `To: ${to}`,
          'Content-Type: text/plain; charset=utf-8',
          'MIME-Version: 1.0',
          `Subject: ${subject}`,
          '',
          body,
        ];

        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const response = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: encodedEmail,
            },
          },
        });

        logger.info('Gmail createDraft success', { tool: 'createDraft', draftId: response.data.id });

        return {
          success: true,
          draftId: response.data.id,
          messageId: response.data.message?.id,
        };
      } catch (error: any) {
        logger.error('Gmail API error', { tool: 'createDraft', error: error.message, status: error.status, to });
        return { success: false, error: error.message };
      }
    },
  }),
};
