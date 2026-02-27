import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { agents, agentTools, aiModels, tools as toolsTable } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { selectBestModel, MODEL_CAPABILITIES } from '@/lib/ai/model-capabilities';
import { getServerSession } from '@/lib/auth-helpers';

const createAgentSchema = z.object({
  prompt: z.string().min(10),
  name: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  modelId: z.string().uuid().optional(),
  tools: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      isActive: agents.isActive,
      requiresApproval: agents.requiresApproval,
      lastRunAt: agents.lastRunAt,
      createdAt: agents.createdAt,
      model: {
        id: aiModels.id,
        name: aiModels.name,
        modelIdentifier: aiModels.modelIdentifier,
      },
    })
    .from(agents)
    .leftJoin(aiModels, eq(agents.modelId, aiModels.id))
    .where(eq(agents.userId, session.user.id))
    .orderBy(desc(agents.createdAt));

  const agentsWithTools = await Promise.all(
    allAgents.map(async (agent) => {
      const agentToolsList = await db
        .select({
          toolId: agentTools.toolId,
          toolName: toolsTable.name,
          toolIdentifier: toolsTable.identifier,
        })
        .from(agentTools)
        .leftJoin(toolsTable, eq(agentTools.toolId, toolsTable.id))
        .where(eq(agentTools.agentId, agent.id));

      return {
        ...agent,
        tools: agentToolsList.map((t) => ({
          id: t.toolId,
          name: t.toolName,
          identifier: t.toolIdentifier,
        })),
      };
    })
  );

  return NextResponse.json(agentsWithTools);
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createAgentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { prompt, name, description, systemPrompt, modelId, tools, requiresApproval } =
    parsed.data;

  let finalModelId = modelId;
  if (!finalModelId) {
    const bestModelKey = selectBestModel(prompt);
    const bestModel = MODEL_CAPABILITIES[bestModelKey];
    if (bestModel) {
      const dbModel = await db
        .select()
        .from(aiModels)
        .where(eq(aiModels.modelIdentifier, bestModel.modelIdentifier))
        .limit(1);
      finalModelId = dbModel[0]?.id;
    }
  }

  if (!finalModelId) {
    const defaultModel = await db.select().from(aiModels).limit(1);
    finalModelId = defaultModel[0]?.id;
  }

  if (!finalModelId) {
    return NextResponse.json({ error: 'No AI models available' }, { status: 500 });
  }

  const agentName = name || generateAgentName(prompt);
  const agentDescription = description || prompt.slice(0, 200);
  const agentSystemPrompt =
    systemPrompt || generateSystemPrompt(prompt, agentName);

  const [newAgent] = await db
    .insert(agents)
    .values({
      userId: session.user.id,
      name: agentName,
      description: agentDescription,
      systemPrompt: agentSystemPrompt,
      modelId: finalModelId,
      isActive: true,
      requiresApproval,
    })
    .returning();

  if (tools && tools.length > 0) {
    const toolRecords = await db
      .select()
      .from(toolsTable)
      .where(eq(toolsTable.identifier, tools[0]));

    const validToolIds: string[] = [];
    for (const toolIdentifier of tools) {
      const toolRecord = await db
        .select()
        .from(toolsTable)
        .where(eq(toolsTable.identifier, toolIdentifier))
        .limit(1);
      if (toolRecord[0]) {
        validToolIds.push(toolRecord[0].id);
      }
    }

    if (validToolIds.length > 0) {
      await db.insert(agentTools).values(
        validToolIds.map((toolId) => ({
          agentId: newAgent.id,
          toolId,
          isEnabled: true,
        }))
      );
    }
  }

  return NextResponse.json(newAgent, { status: 201 });
}

function generateAgentName(prompt: string): string {
  const lowered = prompt.toLowerCase();

  if (lowered.includes('email') || lowered.includes('mail') || lowered.includes('inbox')) {
    return 'Email Assistant';
  }
  if (lowered.includes('calendar') || lowered.includes('schedule') || lowered.includes('meeting')) {
    return 'Calendar Manager';
  }
  if (lowered.includes('code') || lowered.includes('programming') || lowered.includes('developer')) {
    return 'Code Assistant';
  }
  if (lowered.includes('write') || lowered.includes('blog') || lowered.includes('content')) {
    return 'Content Writer';
  }
  if (lowered.includes('file') || lowered.includes('document')) {
    return 'File Manager';
  }

  return 'Custom Agent';
}

function generateSystemPrompt(prompt: string, name: string): string {
  return `You are ${name}, an AI assistant with specific capabilities.

Your primary task is: ${prompt}

Guidelines:
1. Be helpful, accurate, and efficient
2. When using tools, explain what you're doing
3. If you need clarification, ask before proceeding
4. When actions have significant consequences, request approval first
5. Provide clear summaries of completed actions

Always maintain a professional and helpful demeanor.`;
}
