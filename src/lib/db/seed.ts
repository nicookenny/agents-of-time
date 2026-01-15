import { db } from './client';
import {
  aiProviders,
  aiModels,
  modelCapabilities,
  toolCategories,
  oauthProviders,
  tools,
} from './schema';

async function seed() {
  console.log('Seeding database...');

  const [openai] = await db
    .insert(aiProviders)
    .values({ name: 'OpenAI', apiBaseUrl: 'https://api.openai.com/v1' })
    .onConflictDoNothing()
    .returning();

  const [anthropic] = await db
    .insert(aiProviders)
    .values({ name: 'Anthropic', apiBaseUrl: 'https://api.anthropic.com/v1' })
    .onConflictDoNothing()
    .returning();

  const [google] = await db
    .insert(aiProviders)
    .values({ name: 'Google', apiBaseUrl: 'https://generativelanguage.googleapis.com/v1' })
    .onConflictDoNothing()
    .returning();

  console.log('AI Providers seeded');

  const providers = await db.select().from(aiProviders);
  const openaiId = providers.find((p) => p.name === 'OpenAI')!.id;
  const anthropicId = providers.find((p) => p.name === 'Anthropic')!.id;
  const googleId = providers.find((p) => p.name === 'Google')!.id;

  const modelsData = [
    {
      providerId: openaiId,
      name: 'GPT-4o',
      modelIdentifier: 'gpt-4o',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsVision: true,
      supportsTools: true,
      costPer1kInput: '0.005',
      costPer1kOutput: '0.015',
    },
    {
      providerId: openaiId,
      name: 'GPT-4o Mini',
      modelIdentifier: 'gpt-4o-mini',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsVision: true,
      supportsTools: true,
      costPer1kInput: '0.00015',
      costPer1kOutput: '0.0006',
    },
    {
      providerId: anthropicId,
      name: 'Claude Opus 4.5',
      modelIdentifier: 'claude-opus-4-5-20251101',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      supportsVision: true,
      supportsTools: true,
      costPer1kInput: '0.015',
      costPer1kOutput: '0.075',
    },
    {
      providerId: anthropicId,
      name: 'Claude Sonnet 4',
      modelIdentifier: 'claude-sonnet-4-20250514',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      supportsVision: true,
      supportsTools: true,
      costPer1kInput: '0.003',
      costPer1kOutput: '0.015',
    },
    {
      providerId: anthropicId,
      name: 'Claude Haiku 3.5',
      modelIdentifier: 'claude-3-5-haiku-20241022',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsTools: true,
      costPer1kInput: '0.0008',
      costPer1kOutput: '0.004',
    },
    {
      providerId: googleId,
      name: 'Gemini 2.0 Flash',
      modelIdentifier: 'gemini-2.0-flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsTools: true,
      costPer1kInput: '0.0001',
      costPer1kOutput: '0.0004',
    },
  ];

  await db.insert(aiModels).values(modelsData).onConflictDoNothing();
  console.log('AI Models seeded');

  const models = await db.select().from(aiModels);
  const gpt4o = models.find((m) => m.modelIdentifier === 'gpt-4o')!;
  const gpt4oMini = models.find((m) => m.modelIdentifier === 'gpt-4o-mini')!;
  const claudeOpus = models.find((m) => m.modelIdentifier === 'claude-opus-4-5-20251101')!;
  const claudeSonnet = models.find((m) => m.modelIdentifier === 'claude-sonnet-4-20250514')!;
  const claudeHaiku = models.find((m) => m.modelIdentifier === 'claude-3-5-haiku-20241022')!;
  const geminiFlash = models.find((m) => m.modelIdentifier === 'gemini-2.0-flash')!;

  const capabilitiesData = [
    { modelId: gpt4o.id, capabilityType: 'task', capabilityValue: 'code_generation', description: 'Excellent at generating code' },
    { modelId: gpt4o.id, capabilityType: 'task', capabilityValue: 'reasoning', description: 'Strong reasoning capabilities' },
    { modelId: gpt4o.id, capabilityType: 'strength', capabilityValue: 'multimodal', description: 'Can process images and text' },
    { modelId: gpt4o.id, capabilityType: 'best_for', capabilityValue: 'image_analysis', description: 'Good for analyzing images' },
    { modelId: gpt4o.id, capabilityType: 'best_for', capabilityValue: 'general_tasks', description: 'Strong all-rounder' },

    { modelId: gpt4oMini.id, capabilityType: 'strength', capabilityValue: 'speed', description: 'Very fast inference' },
    { modelId: gpt4oMini.id, capabilityType: 'strength', capabilityValue: 'cost_effective', description: 'Low cost per token' },
    { modelId: gpt4oMini.id, capabilityType: 'best_for', capabilityValue: 'simple_classification', description: 'Quick classification tasks' },
    { modelId: gpt4oMini.id, capabilityType: 'best_for', capabilityValue: 'quick_responses', description: 'Fast simple answers' },

    { modelId: claudeOpus.id, capabilityType: 'task', capabilityValue: 'code_generation', description: 'Best-in-class code generation' },
    { modelId: claudeOpus.id, capabilityType: 'task', capabilityValue: 'reasoning', description: 'Exceptional reasoning and analysis' },
    { modelId: claudeOpus.id, capabilityType: 'task', capabilityValue: 'writing', description: 'High quality long-form writing' },
    { modelId: claudeOpus.id, capabilityType: 'best_for', capabilityValue: 'complex_analysis', description: 'Deep analysis tasks' },
    { modelId: claudeOpus.id, capabilityType: 'best_for', capabilityValue: 'code_review', description: 'Thorough code reviews' },
    { modelId: claudeOpus.id, capabilityType: 'best_for', capabilityValue: 'research', description: 'Research and synthesis' },

    { modelId: claudeSonnet.id, capabilityType: 'task', capabilityValue: 'code_generation', description: 'Strong code generation' },
    { modelId: claudeSonnet.id, capabilityType: 'task', capabilityValue: 'general', description: 'Good balance of speed and capability' },
    { modelId: claudeSonnet.id, capabilityType: 'best_for', capabilityValue: 'email_processing', description: 'Email triage and responses' },
    { modelId: claudeSonnet.id, capabilityType: 'best_for', capabilityValue: 'scheduling', description: 'Calendar and scheduling tasks' },
    { modelId: claudeSonnet.id, capabilityType: 'best_for', capabilityValue: 'quick_tasks', description: 'Fast turnaround tasks' },

    { modelId: claudeHaiku.id, capabilityType: 'strength', capabilityValue: 'speed', description: 'Fast inference' },
    { modelId: claudeHaiku.id, capabilityType: 'strength', capabilityValue: 'cost_effective', description: 'Very low cost' },
    { modelId: claudeHaiku.id, capabilityType: 'best_for', capabilityValue: 'simple_classification', description: 'Quick classification' },

    { modelId: geminiFlash.id, capabilityType: 'strength', capabilityValue: 'speed', description: 'Very fast inference' },
    { modelId: geminiFlash.id, capabilityType: 'strength', capabilityValue: 'context', description: 'Massive 1M token context window' },
    { modelId: geminiFlash.id, capabilityType: 'best_for', capabilityValue: 'long_documents', description: 'Processing very long documents' },
  ];

  await db.insert(modelCapabilities).values(capabilitiesData).onConflictDoNothing();
  console.log('Model Capabilities seeded');

  const categoriesData = [
    { name: 'Communication', description: 'Email, messaging, and notification tools' },
    { name: 'Calendar', description: 'Calendar and scheduling tools' },
    { name: 'File System', description: 'Local file and directory operations' },
    { name: 'Development', description: 'Code execution and development tools' },
    { name: 'Web', description: 'Web browsing and API interactions' },
  ];

  await db.insert(toolCategories).values(categoriesData).onConflictDoNothing();
  console.log('Tool Categories seeded');

  const categories = await db.select().from(toolCategories);
  const communicationCat = categories.find((c) => c.name === 'Communication')!;
  const calendarCat = categories.find((c) => c.name === 'Calendar')!;
  const fileSystemCat = categories.find((c) => c.name === 'File System')!;
  const developmentCat = categories.find((c) => c.name === 'Development')!;
  const webCat = categories.find((c) => c.name === 'Web')!;

  const [googleOauth] = await db
    .insert(oauthProviders)
    .values({
      name: 'Google',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    })
    .onConflictDoNothing()
    .returning();

  console.log('OAuth Providers seeded');

  const oauthProvs = await db.select().from(oauthProviders);
  const googleOauthId = oauthProvs.find((p) => p.name === 'Google')!.id;

  const toolsData = [
    {
      categoryId: communicationCat.id,
      name: 'Gmail',
      identifier: 'gmail',
      description: 'Send, read, and manage emails via Gmail API',
      configSchema: { type: 'object', properties: { maxResults: { type: 'integer', default: 50 } } },
      requiresOauth: true,
      oauthProviderId: googleOauthId,
    },
    {
      categoryId: calendarCat.id,
      name: 'Google Calendar',
      identifier: 'google_calendar',
      description: 'Manage calendar events and scheduling',
      configSchema: { type: 'object', properties: { calendarId: { type: 'string', default: 'primary' } } },
      requiresOauth: true,
      oauthProviderId: googleOauthId,
    },
    {
      categoryId: fileSystemCat.id,
      name: 'File Reader',
      identifier: 'file_reader',
      description: 'Read files from the local file system',
      configSchema: { type: 'object', properties: { allowedPaths: { type: 'array', items: { type: 'string' } } } },
      requiresOauth: false,
    },
    {
      categoryId: fileSystemCat.id,
      name: 'File Writer',
      identifier: 'file_writer',
      description: 'Write files to the local file system',
      configSchema: { type: 'object', properties: { allowedPaths: { type: 'array', items: { type: 'string' } } } },
      requiresOauth: false,
    },
    {
      categoryId: developmentCat.id,
      name: 'Bash',
      identifier: 'bash',
      description: 'Execute bash commands',
      configSchema: { type: 'object', properties: { allowedCommands: { type: 'array', items: { type: 'string' } }, timeoutSeconds: { type: 'integer', default: 30 } } },
      requiresOauth: false,
    },
    {
      categoryId: webCat.id,
      name: 'HTTP Request',
      identifier: 'http_request',
      description: 'Make HTTP API requests',
      configSchema: { type: 'object', properties: { baseUrl: { type: 'string' }, headers: { type: 'object' } } },
      requiresOauth: false,
    },
  ];

  await db.insert(tools).values(toolsData).onConflictDoNothing();
  console.log('Tools seeded');

  console.log('Database seeding complete!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});
