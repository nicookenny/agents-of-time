'use server';

import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { agents, agentTools, aiModels, tools as toolsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const agentConfigSchema = z.object({
  name: z.string().describe('A short, descriptive name for the agent (2-4 words)'),
  description: z.string().describe('A brief description of what the agent does (1-2 sentences)'),
  systemPrompt: z.string().describe('Detailed instructions for the agent behavior'),
  tools: z.array(z.enum(['gmail', 'calendar', 'bash', 'file-system'])).describe('Tools the agent needs'),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

export async function generateAgentConfig(prompt: string): Promise<AgentConfig> {
  const result = await generateObject({
    model: anthropic('claude-3-5-haiku-20241022'),
    schema: agentConfigSchema,
    prompt: `Generate an AI agent configuration based on this user request:

"${prompt}"

Create a practical agent with:
- name: Short descriptive name (2-4 words)
- description: Brief summary of capabilities
- systemPrompt: Clear instructions for the agent's behavior and responsibilities
- tools: Only include tools actually needed (gmail for email, calendar for scheduling, bash for system commands, file-system for file operations)`,
  });

  return result.object;
}

export async function createAgent(config: AgentConfig) {
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
