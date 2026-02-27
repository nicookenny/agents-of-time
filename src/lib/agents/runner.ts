import { generateText, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger';
import {
  agents,
  agentTools,
  agentRuns,
  agentActions,
  feedItems,
  aiModels,
  tools as toolsTable,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getToolsByIdentifiers } from '@/lib/tools';
import { setToolContext, clearToolContext } from '@/lib/tools/context';

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

export type TriggerType = 'manual' | 'scheduled' | 'event' | 'webhook';

export interface TriggerDetails {
  source?: string;
  payload?: Record<string, unknown> & {
    flowId?: string;
    flowName?: string;
    actionDescription?: string;
  };
  eventId?: string;
  historyId?: string;
  emailAddress?: string;
  resourceId?: string;
  resourceState?: string;
  channelId?: string;
  event?: Record<string, unknown>;
  minutesUntil?: number;
  interval?: number;
}

function getModelProvider(modelIdentifier: string) {
  if (modelIdentifier.startsWith('claude')) {
    return anthropic(modelIdentifier);
  }
  if (modelIdentifier.startsWith('gpt') || modelIdentifier.startsWith('o1')) {
    return openai(modelIdentifier);
  }
  return anthropic('claude-sonnet-4-20250514');
}

async function getAgentWithDetails(agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
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
      requiresOauth: toolsTable.requiresOauth,
    })
    .from(agentTools)
    .leftJoin(toolsTable, eq(agentTools.toolId, toolsTable.id))
    .where(eq(agentTools.agentId, agentId));

  return { agent, model, tools: agentToolsList };
}

function buildContextFromTrigger(
  triggerType: TriggerType,
  triggerDetails: TriggerDetails
): string {
  switch (triggerType) {
    case 'manual':
      return 'This is a manual run. Please check for any pending tasks and report on the current state.';

    case 'scheduled':
      if (triggerDetails.source === 'flow' && triggerDetails.payload?.actionDescription) {
        return `This is a scheduled flow execution. Flow: "${triggerDetails.payload.flowName}".
Your task: ${triggerDetails.payload.actionDescription}

Execute this task now. Time: ${new Date().toISOString()}`;
      }
      return `This is a scheduled run. Time: ${new Date().toISOString()}. ${
        triggerDetails.source === 'proactive_calendar'
          ? `There is an upcoming calendar event: ${JSON.stringify(triggerDetails.payload)}`
          : 'Please check for any new items that need attention.'
      }`;

    case 'event':
      if (triggerDetails.source === 'gmail') {
        return `A new email event was detected. History ID: ${triggerDetails.historyId}. Please check for new emails and process them according to your instructions.`;
      }
      if (triggerDetails.source === 'calendar') {
        return `A calendar event change was detected. Please check for calendar updates and respond accordingly.`;
      }
      return `An event was detected: ${JSON.stringify(triggerDetails)}`;

    case 'webhook':
      return `A webhook was received with payload: ${JSON.stringify(triggerDetails.payload)}`;

    default:
      return 'Please proceed with your default behavior.';
  }
}

export async function triggerAgent(
  agentId: string,
  triggerType: TriggerType,
  triggerDetails: TriggerDetails = {}
) {
  const { agent, model, tools } = await getAgentWithDetails(agentId);

  logger.info('Agent loaded', {
    agentId,
    name: agent.name,
    toolCount: tools.length,
    model: model?.modelIdentifier,
  });

  if (!agent.isActive) {
    logger.warn('Agent is not active', { agentId });
    return { success: false, error: 'Agent is not active' };
  }

  const [run] = await db
    .insert(agentRuns)
    .values({
      agentId,
      status: 'running',
      triggerType,
      triggerDetails,
      startedAt: new Date(),
    })
    .returning();

  const toolIdentifiers = tools.map((t) => t.identifier).filter(Boolean) as string[];
  const aiTools = getToolsByIdentifiers(toolIdentifiers, true);

  logger.info('Setting tool context for agent run', {
    agentId,
    agentUserId: agent.userId,
    hasUserId: !!agent.userId,
  });
  setToolContext({ agentId, userId: agent.userId });

  let actionSequence = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  logger.info('Starting agent execution', {
    agentId,
    runId: run.id,
    triggerType,
    toolIdentifiers,
  });

  try {
    const result = await generateText({
      model: getModelProvider(model?.modelIdentifier || 'claude-sonnet-4-20250514'),
      system: BASE_SYSTEM_PROMPT + agent.systemPrompt,
      messages: [
        {
          role: 'user',
          content: buildContextFromTrigger(triggerType, triggerDetails),
        },
      ],
      tools: aiTools,
      stopWhen: stepCountIs(10),
      onStepFinish: async ({ text, toolCalls, toolResults, usage }) => {
        totalInputTokens += (usage as any)?.inputTokens || (usage as any)?.promptTokens || 0;
        totalOutputTokens += (usage as any)?.outputTokens || (usage as any)?.completionTokens || 0;

        if (toolCalls && toolCalls.length > 0) {
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i] as any;
            const toolResult = toolResults?.[i] as any;

            const tool = tools.find(
              (t) => t.identifier && aiTools[toolCall.toolName]
            );

            const toolArgs = toolCall.args || toolCall.input || {};

            logger.info('Tool call', {
              agentId,
              runId: run.id,
              tool: toolCall.toolName,
              status: toolResult ? 'success' : 'failed',
              hasResult: !!toolResult?.result,
            });

            const [action] = await db
              .insert(agentActions)
              .values({
                runId: run.id,
                toolId: tool?.toolId || null,
                actionType: 'tool_call',
                actionName: toolCall.toolName,
                inputData: toolArgs,
                outputData: toolResult?.result,
                status: toolResult ? 'completed' : 'failed',
                requiresApproval: agent.requiresApproval,
                sequenceOrder: actionSequence++,
                executedAt: new Date(),
              })
              .returning();

            if (agent.requiresApproval && isActionableToolCall(toolCall.toolName)) {
              await db.insert(feedItems).values({
                agentId,
                runId: run.id,
                actionId: action.id,
                itemType: 'approval_request',
                title: `${agent.name}: ${formatToolName(toolCall.toolName)}`,
                description: `Tool: ${toolCall.toolName}\nInput: ${JSON.stringify(toolArgs, null, 2)}`,
                status: 'pending_approval',
                priority: 'normal',
                proposedAction: {
                  tool: toolCall.toolName,
                  args: toolArgs,
                },
              });
            }
          }
        }

        if (text && text.trim()) {
          await db.insert(feedItems).values({
            agentId,
            runId: run.id,
            itemType: 'info',
            title: `${agent.name} update`,
            description: text.slice(0, 1000),
            status: 'completed',
            priority: 'low',
          });
        }
      },
    });

    await db
      .update(agentRuns)
      .set({
        status: 'completed',
        endedAt: new Date(),
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
      .where(eq(agentRuns.id, run.id));

    await db
      .update(agents)
      .set({ lastRunAt: new Date() })
      .where(eq(agents.id, agentId));

    logger.info('Agent run completed', {
      agentId,
      runId: run.id,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

    clearToolContext();
    return {
      success: true,
      runId: run.id,
      text: result.text,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  } catch (error: any) {
    logger.error('Agent run failed', {
      agentId,
      runId: run.id,
      error: error.message,
      stack: error.stack,
    });

    clearToolContext();
    await db
      .update(agentRuns)
      .set({
        status: 'failed',
        endedAt: new Date(),
        errorMessage: error.message,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
      .where(eq(agentRuns.id, run.id));

    await db.insert(feedItems).values({
      agentId,
      runId: run.id,
      itemType: 'error',
      title: `${agent.name} failed`,
      description: error.message,
      status: 'completed',
      priority: 'high',
    });

    return {
      success: false,
      runId: run.id,
      error: error.message,
    };
  }
}

function isActionableToolCall(toolName: string): boolean {
  const actionableTools = [
    'sendEmail',
    'createEvent',
    'updateEvent',
    'deleteEvent',
    'writeFile',
    'deleteFile',
    'executeCommand',
  ];
  return actionableTools.includes(toolName);
}

function formatToolName(toolName: string): string {
  return toolName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export async function runAgentManually(agentId: string) {
  return triggerAgent(agentId, 'manual', {});
}
