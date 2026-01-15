export type CostTier = 'low' | 'medium' | 'high';

export type CapabilityStrength =
  | 'code_generation'
  | 'reasoning'
  | 'long_context'
  | 'writing'
  | 'multimodal'
  | 'speed'
  | 'cost_effective'
  | 'general'
  | 'tool_use'
  | 'complex_analysis';

export type TaskType =
  | 'email_processing'
  | 'calendar_management'
  | 'code_tasks'
  | 'writing'
  | 'research'
  | 'quick_responses'
  | 'image_analysis'
  | 'complex_reasoning'
  | 'simple_classification';

export interface ModelCapability {
  provider: 'anthropic' | 'openai';
  modelIdentifier: string;
  displayName: string;
  strengths: CapabilityStrength[];
  bestFor: TaskType[];
  contextWindow: number;
  maxOutputTokens: number;
  costTier: CostTier;
  supportsVision: boolean;
  supportsTools: boolean;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'claude-opus-4-5': {
    provider: 'anthropic',
    modelIdentifier: 'claude-opus-4-5-20251101',
    displayName: 'Claude Opus 4.5',
    strengths: ['code_generation', 'reasoning', 'long_context', 'writing', 'complex_analysis'],
    bestFor: ['complex_reasoning', 'research', 'writing', 'code_tasks'],
    contextWindow: 200000,
    maxOutputTokens: 32000,
    costTier: 'high',
    supportsVision: true,
    supportsTools: true,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  'claude-sonnet-4': {
    provider: 'anthropic',
    modelIdentifier: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    strengths: ['code_generation', 'general', 'speed', 'tool_use'],
    bestFor: ['email_processing', 'calendar_management', 'code_tasks', 'quick_responses'],
    contextWindow: 200000,
    maxOutputTokens: 64000,
    costTier: 'medium',
    supportsVision: true,
    supportsTools: true,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  'claude-haiku-3-5': {
    provider: 'anthropic',
    modelIdentifier: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku 3.5',
    strengths: ['speed', 'cost_effective', 'tool_use'],
    bestFor: ['simple_classification', 'quick_responses'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costTier: 'low',
    supportsVision: true,
    supportsTools: true,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },
  'gpt-4o': {
    provider: 'openai',
    modelIdentifier: 'gpt-4o',
    displayName: 'GPT-4o',
    strengths: ['multimodal', 'reasoning', 'code_generation', 'general'],
    bestFor: ['image_analysis', 'code_tasks', 'writing', 'research'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costTier: 'medium',
    supportsVision: true,
    supportsTools: true,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    modelIdentifier: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    strengths: ['speed', 'cost_effective', 'general'],
    bestFor: ['simple_classification', 'quick_responses', 'email_processing'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costTier: 'low',
    supportsVision: true,
    supportsTools: true,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  'o1': {
    provider: 'openai',
    modelIdentifier: 'o1',
    displayName: 'OpenAI o1',
    strengths: ['reasoning', 'complex_analysis', 'code_generation'],
    bestFor: ['complex_reasoning', 'research', 'code_tasks'],
    contextWindow: 200000,
    maxOutputTokens: 100000,
    costTier: 'high',
    supportsVision: true,
    supportsTools: false,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.06,
  },
};

const TASK_TO_CAPABILITIES: Record<TaskType, CapabilityStrength[]> = {
  email_processing: ['speed', 'general', 'tool_use'],
  calendar_management: ['tool_use', 'general', 'speed'],
  code_tasks: ['code_generation', 'reasoning'],
  writing: ['writing', 'long_context'],
  research: ['reasoning', 'long_context', 'complex_analysis'],
  quick_responses: ['speed', 'cost_effective'],
  image_analysis: ['multimodal'],
  complex_reasoning: ['reasoning', 'complex_analysis'],
  simple_classification: ['speed', 'cost_effective'],
};

export function selectBestModel(
  taskDescription: string,
  preferredCostTier?: CostTier,
  requiresVision?: boolean,
  requiresTools?: boolean
): string {
  const loweredDesc = taskDescription.toLowerCase();

  let detectedTasks: TaskType[] = [];

  if (loweredDesc.includes('email') || loweredDesc.includes('inbox') || loweredDesc.includes('message')) {
    detectedTasks.push('email_processing');
  }
  if (loweredDesc.includes('calendar') || loweredDesc.includes('meeting') || loweredDesc.includes('schedule')) {
    detectedTasks.push('calendar_management');
  }
  if (loweredDesc.includes('code') || loweredDesc.includes('programming') || loweredDesc.includes('script') || loweredDesc.includes('bash')) {
    detectedTasks.push('code_tasks');
  }
  if (loweredDesc.includes('write') || loweredDesc.includes('blog') || loweredDesc.includes('article') || loweredDesc.includes('draft')) {
    detectedTasks.push('writing');
  }
  if (loweredDesc.includes('research') || loweredDesc.includes('analyze') || loweredDesc.includes('investigate')) {
    detectedTasks.push('research');
  }
  if (loweredDesc.includes('image') || loweredDesc.includes('photo') || loweredDesc.includes('picture') || loweredDesc.includes('screenshot')) {
    detectedTasks.push('image_analysis');
  }
  if (loweredDesc.includes('complex') || loweredDesc.includes('difficult') || loweredDesc.includes('advanced')) {
    detectedTasks.push('complex_reasoning');
  }
  if (loweredDesc.includes('simple') || loweredDesc.includes('quick') || loweredDesc.includes('fast') || loweredDesc.includes('classify')) {
    detectedTasks.push('quick_responses');
  }

  if (detectedTasks.length === 0) {
    detectedTasks = ['email_processing'];
  }

  const requiredCapabilities = new Set<CapabilityStrength>();
  for (const task of detectedTasks) {
    const caps = TASK_TO_CAPABILITIES[task] || [];
    caps.forEach((c) => requiredCapabilities.add(c));
  }

  const candidates = Object.entries(MODEL_CAPABILITIES)
    .map(([key, model]) => {
      let score = 0;

      if (requiresVision && !model.supportsVision) return { key, score: -1 };
      if (requiresTools && !model.supportsTools) return { key, score: -1 };

      for (const cap of requiredCapabilities) {
        if (model.strengths.includes(cap)) score += 10;
      }

      for (const task of detectedTasks) {
        if (model.bestFor.includes(task)) score += 15;
      }

      if (preferredCostTier) {
        if (model.costTier === preferredCostTier) score += 5;
        else if (preferredCostTier === 'low' && model.costTier === 'medium') score += 2;
        else if (preferredCostTier === 'medium' && model.costTier === 'low') score += 3;
      }

      return { key, score };
    })
    .filter((c) => c.score >= 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.key || 'claude-sonnet-4';
}

export function getModelByIdentifier(identifier: string): ModelCapability | undefined {
  return Object.values(MODEL_CAPABILITIES).find(
    (m) => m.modelIdentifier === identifier
  );
}

export function getAllModels(): ModelCapability[] {
  return Object.values(MODEL_CAPABILITIES);
}

export function getModelsByProvider(provider: 'anthropic' | 'openai'): ModelCapability[] {
  return Object.values(MODEL_CAPABILITIES).filter((m) => m.provider === provider);
}
