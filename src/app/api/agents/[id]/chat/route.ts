import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { db } from '@/lib/db/client';
import {
  agents,
  agentTools,
  aiModels,
  tools as toolsTable,
  chatConversations,
  chatMessages,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getToolsByIdentifiers } from '@/lib/tools';
import { setToolContext, clearToolContext } from '@/lib/tools/context';
import { getServerSession } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

const BASE_SYSTEM_PROMPT = `## Important Guidelines

### Communication Style
- NEVER mention tool names, function names, or internal system details to the user
- Speak naturally as if you're performing actions directly, not calling tools
- Bad: "I'll use the listEmails function to retrieve your emails"
- Good: "Let me check your recent emails"
- Bad: "The createFlow tool returned an error"
- Good: "I wasn't able to set up that automation"

### Response Formatting
- Keep responses concise and conversational
- Don't use excessive markdown formatting or numbered lists unless truly helpful
- Avoid step-by-step narration of your internal process
- Present results naturally, as a helpful assistant would

### Default Tools
You have access to these tools that are always available:
- getCurrentDate: Returns the current real date/time. ALWAYS call this FIRST when handling any request involving dates, times, scheduling, or relative time references (today, tomorrow, this week, next Monday, etc.). Trust the result - it is accurate.

`;

function getModelProvider(modelIdentifier: string) {
  if (modelIdentifier.startsWith('claude')) {
    return anthropic(modelIdentifier);
  }
  if (modelIdentifier.startsWith('gpt') || modelIdentifier.startsWith('o1')) {
    return openai(modelIdentifier);
  }
  return anthropic('claude-sonnet-4-20250514');
}

async function getAgentWithDetails(agentId: string, userId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
    .limit(1);

  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const [model] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.id, agent.modelId))
    .limit(1);

  const agentToolsList = await db
    .select({
      toolId: agentTools.toolId,
      identifier: toolsTable.identifier,
      name: toolsTable.name,
    })
    .from(agentTools)
    .leftJoin(toolsTable, eq(agentTools.toolId, toolsTable.id))
    .where(eq(agentTools.agentId, agentId));

  return { agent, model, tools: agentToolsList };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;
  const { messages, conversationId } = await req.json();

  logger.info('Chat request received', {
    agentId,
    userId: session.user.id,
  });

  const { agent, model, tools } = await getAgentWithDetails(agentId, session.user.id);

  let convId = conversationId;
  if (!convId) {
    const firstMessage = messages[0]?.content || 'New conversation';
    const title = typeof firstMessage === 'string'
      ? firstMessage.slice(0, 100)
      : 'New conversation';

    const [conv] = await db
      .insert(chatConversations)
      .values({ agentId, title, userId: session.user.id })
      .returning();
    convId = conv.id;
  }

  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage?.role === 'user') {
    await db.insert(chatMessages).values({
      conversationId: convId,
      role: 'user',
      content: typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : JSON.stringify(lastUserMessage.content),
    });
  }

  const toolIdentifiers = tools.map((t) => t.identifier).filter(Boolean) as string[];
  const aiTools = getToolsByIdentifiers(toolIdentifiers, true);

  logger.info('Setting tool context for chat', {
    agentId,
    userId: session.user.id,
    toolCount: toolIdentifiers.length,
    tools: toolIdentifiers,
  });
  setToolContext({ agentId, userId: session.user.id });

  const result = streamText({
    model: getModelProvider(model?.modelIdentifier || 'claude-sonnet-4-20250514'),
    system: BASE_SYSTEM_PROMPT + agent.systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: aiTools,
    stopWhen: stepCountIs(10),
    onFinish: async ({ text, toolCalls, toolResults }) => {
      clearToolContext();

      await db.insert(chatMessages).values({
        conversationId: convId,
        role: 'assistant',
        content: text || null,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
        toolResults: toolResults && toolResults.length > 0 ? toolResults : null,
      });

      await db
        .update(chatConversations)
        .set({ updatedAt: new Date() })
        .where(eq(chatConversations.id, convId));
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return { conversationId: convId };
      }
    },
  });
}
