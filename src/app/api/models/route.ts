import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { aiModels, aiProviders, modelCapabilities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { selectBestModel, MODEL_CAPABILITIES } from '@/lib/ai/model-capabilities';

export async function GET() {
  const models = await db
    .select({
      id: aiModels.id,
      name: aiModels.name,
      modelIdentifier: aiModels.modelIdentifier,
      contextWindow: aiModels.contextWindow,
      maxOutputTokens: aiModels.maxOutputTokens,
      supportsVision: aiModels.supportsVision,
      supportsTools: aiModels.supportsTools,
      costPer1kInput: aiModels.costPer1kInput,
      costPer1kOutput: aiModels.costPer1kOutput,
      isActive: aiModels.isActive,
      provider: {
        id: aiProviders.id,
        name: aiProviders.name,
      },
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(eq(aiModels.isActive, true));

  const modelsWithCapabilities = await Promise.all(
    models.map(async (model) => {
      const caps = await db
        .select({
          type: modelCapabilities.capabilityType,
          value: modelCapabilities.capabilityValue,
        })
        .from(modelCapabilities)
        .where(eq(modelCapabilities.modelId, model.id));

      return {
        ...model,
        capabilities: caps,
      };
    })
  );

  return NextResponse.json(modelsWithCapabilities);
}

export async function POST(req: Request) {
  const { taskDescription, preferredCostTier, requiresVision, requiresTools } =
    await req.json();

  const bestModelKey = selectBestModel(
    taskDescription,
    preferredCostTier,
    requiresVision,
    requiresTools
  );

  const modelConfig = MODEL_CAPABILITIES[bestModelKey];

  if (!modelConfig) {
    return NextResponse.json(
      { error: 'Could not determine best model' },
      { status: 500 }
    );
  }

  const [dbModel] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.modelIdentifier, modelConfig.modelIdentifier))
    .limit(1);

  return NextResponse.json({
    recommended: bestModelKey,
    modelIdentifier: modelConfig.modelIdentifier,
    displayName: modelConfig.displayName,
    provider: modelConfig.provider,
    reasoning: {
      strengths: modelConfig.strengths,
      bestFor: modelConfig.bestFor,
      costTier: modelConfig.costTier,
    },
    dbModel: dbModel || null,
  });
}
