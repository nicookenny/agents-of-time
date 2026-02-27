'use server';

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { agents, agentTools, aiModels, tools as toolsTable, userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from '@/lib/auth-helpers';
import { OllamaClient } from '@/lib/ai/ollama-client';

const agentConfigSchema = z.object({
  name: z.string().describe('A short, descriptive name for the agent (2-4 words)'),
  description: z.string().describe('A brief description of what the agent does (1-2 sentences)'),
  systemPrompt: z.string().describe('Detailed instructions for the agent behavior'),
  tools: z.array(z.enum(['gmail', 'calendar', 'bash', 'file-system'])).describe('Tools the agent needs'),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

async function getUserAISettings(userId: string) {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return settings || {
    aiProvider: 'cloud',
    cloudModel: 'claude-3-5-haiku-20241022',
    ollamaModel: 'llama3.2:3b',
  };
}

function getCloudModel(modelId: string) {
  if (modelId.startsWith('gpt-')) {
    return openai(modelId);
  }
  return anthropic(modelId);
}

const GENERATION_PROMPT = `Generate an AI agent configuration based on this user request.

Create a practical agent with:
- name: Short descriptive name (2-4 words)
- description: Brief summary of capabilities
- systemPrompt: Clear instructions for the agent's behavior and responsibilities
- tools: Only include tools actually needed (gmail for email, calendar for scheduling, bash for system commands, file-system for file operations)

Return a JSON object with: name, description, systemPrompt, tools (array)

User request:`;

export async function generateAgentConfig(prompt: string): Promise<AgentConfig> {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const settings = await getUserAISettings(session.user.id);
  const model = settings.aiProvider === 'ollama'
    ? (settings.ollamaModel || 'llama3.2:3b')
    : (settings.cloudModel || 'claude-3-5-haiku-20241022');

  console.log(`[Agent Gen] Provider: ${settings.aiProvider}, Model: ${model}`);
  const startTime = Date.now();

  if (settings.aiProvider === 'ollama') {
    console.log(`[Agent Gen] Connecting to Ollama...`);
    try {
      const client = new OllamaClient(settings.ollamaModel || 'llama3.2:3b');
      const result = await client.generateStructured(
        `${GENERATION_PROMPT}\n\n"${prompt}"`,
        agentConfigSchema
      );
      console.log(`[Agent Gen] Ollama completed in ${Date.now() - startTime}ms`);
      return result.data;
    } catch (error: any) {
      console.error(`[Agent Gen] Ollama failed after ${Date.now() - startTime}ms:`, error.message);
      throw error;
    }
  }

  try {
    console.log(`[Agent Gen] Calling Cloud AI...`);
    const result = await generateObject({
      model: getCloudModel(settings.cloudModel || 'claude-3-5-haiku-20241022'),
      schema: agentConfigSchema,
      prompt: `${GENERATION_PROMPT}\n\n"${prompt}"`,
    });
    console.log(`[Agent Gen] Cloud completed in ${Date.now() - startTime}ms`);
    return result.object;
  } catch (error: any) {
    console.error(`[Agent Gen] Cloud failed after ${Date.now() - startTime}ms:`, error.message);
    throw error;
  }
}

export async function createAgent(config: AgentConfig) {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const [haikuModel] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.modelIdentifier, 'claude-3-5-haiku-20241022'))
    .limit(1);

  if (!haikuModel) {
    throw new Error('Haiku model not found in database');
  }

  const [newAgent] = await db
    .insert(agents)
    .values({
      userId: session.user.id,
      name: config.name,
      description: config.description,
      systemPrompt: config.systemPrompt,
      modelId: haikuModel.id,
      isActive: true,
      requiresApproval: true,
    })
    .returning();

  for (const toolIdentifier of config.tools) {
    const [tool] = await db
      .select()
      .from(toolsTable)
      .where(eq(toolsTable.identifier, toolIdentifier))
      .limit(1);

    if (tool) {
      await db.insert(agentTools).values({
        agentId: newAgent.id,
        toolId: tool.id,
        isEnabled: true,
      });
    }
  }

  return newAgent;
}
