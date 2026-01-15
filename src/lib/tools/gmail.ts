import { tool } from 'ai';
import { z } from 'zod';
import { google } from 'googleapis';
import { getToolContext } from './context';

export interface GmailContext {
  accessToken: string;
}

async function getGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
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
      const { accessToken } = getToolContext<GmailContext>();
      if (!accessToken) {
        return { error: 'No Gmail access token available', emails: [], total: 0 };
      }
      const gmail = await getGmailClient(accessToken);

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        labelIds,
      });

      const messages = response.data.messages || [];
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
    },
  }),

  readEmail: tool({
    description: 'Read the full content of a specific email',
    inputSchema: z.object({
      messageId: z.string().describe('The Gmail message ID'),
    }),
    execute: async ({ messageId }) => {
      const { accessToken } = getToolContext<GmailContext>();
      if (!accessToken) {
        return { error: 'No Gmail access token available' };
      }
      const gmail = await getGmailClient(accessToken);

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

      return {
        id: messageId,
        from: getHeader('from'),
        to: getHeader('to'),
        subject: getHeader('subject'),
        date: getHeader('date'),
        body,
        labelIds: response.data.labelIds,
      };
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
      const { accessToken } = getToolContext<GmailContext>();
      if (!accessToken) {
        return { success: false, error: 'No Gmail access token available' };
      }
      const gmail = await getGmailClient(accessToken);

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

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
      };
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
      const { accessToken } = getToolContext<GmailContext>();
      if (!accessToken) {
        return { success: false, error: 'No Gmail access token available' };
      }
      const gmail = await getGmailClient(accessToken);

      const response = await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
        labelIds: response.data.labelIds,
      };
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
      const { accessToken } = getToolContext<GmailContext>();
      if (!accessToken) {
        return { success: false, error: 'No Gmail access token available' };
      }
      const gmail = await getGmailClient(accessToken);

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

      return {
        success: true,
        draftId: response.data.id,
        messageId: response.data.message?.id,
      };
    },
  }),
};
