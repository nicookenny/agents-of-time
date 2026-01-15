import { z } from 'zod';
import { ollamaClient } from '@/lib/ai/ollama-client';
import { db } from '@/lib/db/client';
import { processedEmails, connectedAccounts, type ProcessedEmail } from '@/lib/db/schema';
import { getGmailClient } from '@/lib/tools/gmail-helper';
import { eq } from 'drizzle-orm';

// Zod schema for email analysis output
export const EmailAnalysisSchema = z.object({
  summary: z.string().describe('Concise 1-2 sentence summary of email content'),
  actionables: z.array(z.string()).describe('List of specific action items extracted from email'),
  needs_action: z.boolean().describe('Whether this email requires any action'),
  actionable_by: z.enum(['human', 'ai', 'null']).describe('Who should handle the action: human (requires human judgment), ai (can be automated), or null (no action needed)'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  category: z.string().optional().describe('Email category: work, personal, marketing, notification, etc.'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  key_entities: z.object({
    people: z.array(z.string()).optional(),
    organizations: z.array(z.string()).optional(),
    dates: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
  }).optional(),
  suggested_labels: z.array(z.string()).optional().describe('Suggested Gmail labels'),
});

export type EmailAnalysis = z.infer<typeof EmailAnalysisSchema>;

interface EmailData {
  messageId: string;
  threadId?: string;
  sender: string;
  subject?: string;
  date: string;
  body: string;
  snippet?: string;
}

export class EmailProcessorService {
  private ollamaModel: string;

  constructor(model?: string) {
    this.ollamaModel = model || process.env.OLLAMA_EMAIL_MODEL || 'llama3.2:3b';
  }

  /**
   * Process a single email with Ollama LLM
   */
  async processEmail(
    emailData: EmailData,
    connectedAccountId: string
  ): Promise<ProcessedEmail> {
    const startTime = Date.now();

    try {
      // Generate analysis prompt
      const prompt = this.buildAnalysisPrompt(emailData);
      const systemPrompt = this.getSystemPrompt();

      // Call Ollama
      const { data: analysis, timeMs } = await ollamaClient.generateStructured(
        prompt,
        EmailAnalysisSchema,
        {
          model: this.ollamaModel,
          systemPrompt,
          temperature: 0.3,
        }
      );

      // Convert actionable_by from string to enum value
      const actionableBy = analysis.actionable_by === 'null'
        ? null
        : analysis.actionable_by as 'human' | 'ai';

      // Store in database
      const [processedEmail] = await db.insert(processedEmails).values({
        messageId: emailData.messageId,
        threadId: emailData.threadId,
        connectedAccountId,
        sender: emailData.sender,
        subject: emailData.subject,
        receivedDate: new Date(emailData.date),
        bodySnippet: emailData.snippet,
        summary: analysis.summary,
        actionables: analysis.actionables,
        needsAction: analysis.needs_action,
        actionableBy,
        sentiment: analysis.sentiment,
        category: analysis.category,
        priority: analysis.priority || 'normal',
        keyEntities: analysis.key_entities,
        suggestedLabels: analysis.suggested_labels,
        processedAt: new Date(),
        processingTimeMs: timeMs,
        modelUsed: this.ollamaModel,
      }).returning();

      return processedEmail;
    } catch (error: any) {
      // Store error in database for debugging
      const [errorRecord] = await db.insert(processedEmails).values({
        messageId: emailData.messageId,
        threadId: emailData.threadId,
        connectedAccountId,
        sender: emailData.sender,
        subject: emailData.subject,
        receivedDate: new Date(emailData.date),
        bodySnippet: emailData.snippet,
        processingError: error.message,
        processedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        modelUsed: this.ollamaModel,
        needsAction: false, // Default safe value
      }).returning();

      throw new Error(`Email processing failed: ${error.message}`);
    }
  }

  /**
   * Process email from Gmail webhook notification
   */
  async processFromWebhook(
    historyId: string,
    emailAddress: string
  ): Promise<ProcessedEmail[]> {
    // Get connected account
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.accountEmail, emailAddress))
      .limit(1);

    if (!account) {
      throw new Error(`No connected account found for ${emailAddress}`);
    }

    // Fetch recent emails using Gmail API
    const gmail = await getGmailClient(account.accessToken);

    // Get emails from history
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
    });

    const messageIds = history.data.history
      ?.flatMap(h => h.messagesAdded?.map(m => m.message?.id))
      .filter(Boolean) as string[] || [];

    // Process each new message
    const processed: ProcessedEmail[] = [];
    for (const messageId of messageIds) {
      try {
        // Check if already processed
        const existing = await db
          .select()
          .from(processedEmails)
          .where(eq(processedEmails.messageId, messageId))
          .limit(1);

        if (existing.length > 0) {
          console.log(`Email ${messageId} already processed, skipping`);
          continue;
        }

        // Fetch full email
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const headers = message.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract body
        let body = '';
        const payload = message.data.payload;
        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          const textPart = payload.parts.find(
            p => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
          );
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        const emailData: EmailData = {
          messageId,
          threadId: message.data.threadId,
          sender: getHeader('from'),
          subject: getHeader('subject'),
          date: getHeader('date'),
          body,
          snippet: message.data.snippet,
        };

        const result = await this.processEmail(emailData, account.id);
        processed.push(result);
      } catch (error: any) {
        console.error(`Failed to process email ${messageId}:`, error.message);
        // Continue processing other emails
      }
    }

    return processed;
  }

  private buildAnalysisPrompt(emailData: EmailData): string {
    return `Analyze the following email and extract structured information:

FROM: ${emailData.sender}
SUBJECT: ${emailData.subject}
DATE: ${emailData.date}

BODY:
${emailData.body.slice(0, 4000)}

Please extract:
1. A concise summary (1-2 sentences)
2. Any actionable items or tasks mentioned
3. Whether action is needed (true/false)
4. Who should handle it: "human" (requires human judgment/decision), "ai" (can be automated), or "null" (no action)
5. Sentiment, category, priority
6. Key entities (people, organizations, dates, locations)
7. Suggested Gmail labels

Return ONLY valid JSON matching the expected schema.`;
  }

  private getSystemPrompt(): string {
    return `You are an expert email analysis assistant. Your job is to:
1. Accurately summarize email content
2. Extract actionable items and tasks
3. Determine if action is needed and who should handle it
4. Identify key information like people, dates, organizations
5. Categorize and prioritize emails

Always return valid JSON. Be concise but thorough. For actionable_by:
- Use "human" for emails requiring decisions, approvals, personal responses, or subjective judgment
- Use "ai" for routine tasks that can be automated (scheduling, data entry, simple replies)
- Use "null" for informational emails with no action needed`;
  }

  async checkOllamaAvailability(): Promise<boolean> {
    return await ollamaClient.isAvailable();
  }
}

export const emailProcessor = new EmailProcessorService();
