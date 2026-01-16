import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const runStatusEnum = pgEnum('run_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const triggerTypeEnum = pgEnum('trigger_type', [
  'scheduled',
  'manual',
  'event',
  'webhook',
]);

export const actionStatusEnum = pgEnum('action_status', [
  'pending',
  'pending_approval',
  'approved',
  'rejected',
  'executing',
  'completed',
  'failed',
]);

export const feedItemTypeEnum = pgEnum('feed_item_type', [
  'action_required',
  'completed',
  'info',
  'error',
  'approval_request',
]);

export const feedItemStatusEnum = pgEnum('feed_item_status', [
  'pending',
  'pending_approval',
  'approved',
  'rejected',
  'completed',
  'dismissed',
]);

export const priorityLevelEnum = pgEnum('priority_level', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const actionableByEnum = pgEnum('actionable_by', ['human', 'ai']);

export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  apiBaseUrl: varchar('api_base_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiModels = pgTable(
  'ai_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => aiProviders.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    modelIdentifier: varchar('model_identifier', { length: 100 }).notNull(),
    contextWindow: integer('context_window').notNull(),
    maxOutputTokens: integer('max_output_tokens'),
    supportsVision: boolean('supports_vision').notNull().default(false),
    supportsTools: boolean('supports_tools').notNull().default(false),
    costPer1kInput: decimal('cost_per_1k_input', { precision: 10, scale: 6 }),
    costPer1kOutput: decimal('cost_per_1k_output', { precision: 10, scale: 6 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ai_models_provider_identifier_idx').on(
      table.providerId,
      table.modelIdentifier
    ),
    index('ai_models_provider_idx').on(table.providerId),
    index('ai_models_active_idx').on(table.isActive),
  ]
);

export const modelCapabilities = pgTable(
  'model_capabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => aiModels.id, { onDelete: 'cascade' }),
    capabilityType: varchar('capability_type', { length: 50 }).notNull(),
    capabilityValue: varchar('capability_value', { length: 200 }).notNull(),
    description: text('description'),
  },
  (table) => [
    uniqueIndex('model_capabilities_unique_idx').on(
      table.modelId,
      table.capabilityType,
      table.capabilityValue
    ),
    index('model_capabilities_model_idx').on(table.modelId),
    index('model_capabilities_type_idx').on(table.capabilityType),
  ]
);

export const toolCategories = pgTable('tool_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
});

export const oauthProviders = pgTable('oauth_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  authUrl: varchar('auth_url', { length: 500 }).notNull(),
  tokenUrl: varchar('token_url', { length: 500 }).notNull(),
  scopes: text('scopes').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id').references(() => toolCategories.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 100 }).notNull().unique(),
    identifier: varchar('identifier', { length: 100 }).notNull().unique(),
    description: text('description'),
    configSchema: jsonb('config_schema'),
    requiresOauth: boolean('requires_oauth').notNull().default(false),
    oauthProviderId: uuid('oauth_provider_id').references(() => oauthProviders.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tools_category_idx').on(table.categoryId),
    index('tools_oauth_provider_idx').on(table.oauthProviderId),
  ]
);

export const connectedAccounts = pgTable(
  'connected_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => oauthProviders.id, { onDelete: 'cascade' }),
    accountIdentifier: varchar('account_identifier', { length: 255 }).notNull(),
    accountEmail: varchar('account_email', { length: 255 }),
    accountName: varchar('account_name', { length: 255 }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopesGranted: text('scopes_granted').array(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('connected_accounts_provider_identifier_idx').on(
      table.providerId,
      table.accountIdentifier
    ),
    index('connected_accounts_provider_idx').on(table.providerId),
    index('connected_accounts_active_idx').on(table.isActive),
    index('connected_accounts_expires_idx').on(table.tokenExpiresAt),
  ]
);

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    systemPrompt: text('system_prompt').notNull(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => aiModels.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    requiresApproval: boolean('requires_approval').notNull().default(true),
    approvalThreshold: varchar('approval_threshold', { length: 50 }).default('all'),
    runIntervalSeconds: integer('run_interval_seconds').default(300),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agents_model_idx').on(table.modelId),
    index('agents_active_idx').on(table.isActive),
    index('agents_last_run_idx').on(table.lastRunAt),
  ]
);

export const agentTools = pgTable(
  'agent_tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    configuration: jsonb('configuration'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_tools_unique_idx').on(table.agentId, table.toolId),
    index('agent_tools_agent_idx').on(table.agentId),
    index('agent_tools_tool_idx').on(table.toolId),
  ]
);

export const agentConnectedAccounts = pgTable(
  'agent_connected_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    connectedAccountId: uuid('connected_account_id')
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('agent_connected_accounts_unique_idx').on(
      table.agentId,
      table.connectedAccountId,
      table.toolId
    ),
    index('agent_connected_accounts_agent_idx').on(table.agentId),
    index('agent_connected_accounts_account_idx').on(table.connectedAccountId),
  ]
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    status: runStatusEnum('status').notNull().default('pending'),
    triggerType: triggerTypeEnum('trigger_type').notNull().default('scheduled'),
    triggerDetails: jsonb('trigger_details'),
    inputTokens: integer('input_tokens').default(0),
    outputTokens: integer('output_tokens').default(0),
    totalCost: decimal('total_cost', { precision: 10, scale: 6 }).default('0'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('agent_runs_agent_idx').on(table.agentId),
    index('agent_runs_status_idx').on(table.status),
    index('agent_runs_started_idx').on(table.startedAt),
  ]
);

export const agentActions = pgTable(
  'agent_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'set null' }),
    actionType: varchar('action_type', { length: 100 }).notNull(),
    actionName: varchar('action_name', { length: 200 }),
    inputData: jsonb('input_data'),
    outputData: jsonb('output_data'),
    status: actionStatusEnum('status').notNull().default('pending'),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    sequenceOrder: integer('sequence_order').notNull().default(0),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('agent_actions_run_idx').on(table.runId),
    index('agent_actions_tool_idx').on(table.toolId),
    index('agent_actions_status_idx').on(table.status),
    index('agent_actions_sequence_idx').on(table.runId, table.sequenceOrder),
  ]
);

export const feedItems = pgTable(
  'feed_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actionId: uuid('action_id').references(() => agentActions.id, {
      onDelete: 'set null',
    }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    itemType: feedItemTypeEnum('item_type').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    status: feedItemStatusEnum('status').notNull().default('pending'),
    priority: priorityLevelEnum('priority').notNull().default('normal'),
    metadata: jsonb('metadata'),
    proposedAction: jsonb('proposed_action'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('feed_items_agent_idx').on(table.agentId),
    index('feed_items_action_idx').on(table.actionId),
    index('feed_items_run_idx').on(table.runId),
    index('feed_items_status_idx').on(table.status),
    index('feed_items_type_idx').on(table.itemType),
    index('feed_items_created_idx').on(table.createdAt),
    index('feed_items_priority_idx').on(table.priority, table.createdAt),
  ]
);

export const approvalLogs = pgTable(
  'approval_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    feedItemId: uuid('feed_item_id')
      .notNull()
      .references(() => feedItems.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').references(() => agentActions.id, {
      onDelete: 'set null',
    }),
    decision: varchar('decision', { length: 50 }).notNull(),
    reason: text('reason'),
    modifications: jsonb('modifications'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('approval_logs_feed_item_idx').on(table.feedItemId),
    index('approval_logs_action_idx').on(table.actionId),
    index('approval_logs_decided_idx').on(table.decidedAt),
  ]
);

export const eventLogs = pgTable(
  'event_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    sourceType: varchar('source_type', { length: 100 }).notNull(),
    sourceId: uuid('source_id'),
    payload: jsonb('payload'),
    processed: boolean('processed').notNull().default(false),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('event_logs_type_idx').on(table.eventType),
    index('event_logs_source_idx').on(table.sourceType, table.sourceId),
    index('event_logs_unprocessed_idx').on(table.processed, table.createdAt),
    index('event_logs_created_idx').on(table.createdAt),
  ]
);

export const processedEmails = pgTable(
  'processed_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Email identifiers
    messageId: varchar('message_id', { length: 255 }).notNull().unique(),
    threadId: varchar('thread_id', { length: 255 }),
    connectedAccountId: uuid('connected_account_id')
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: 'cascade' }),

    // Raw email data
    sender: varchar('sender', { length: 500 }).notNull(),
    subject: varchar('subject', { length: 1000 }),
    receivedDate: timestamp('received_date', { withTimezone: true }).notNull(),
    bodySnippet: text('body_snippet'),

    // AI-extracted fields
    summary: text('summary'),
    actionables: jsonb('actionables').$type<string[]>(),
    needsAction: boolean('needs_action').notNull().default(false),
    actionableBy: actionableByEnum('actionable_by'),

    // Additional AI insights
    sentiment: varchar('sentiment', { length: 50 }),
    category: varchar('category', { length: 100 }),
    priority: priorityLevelEnum('priority').default('normal'),
    keyEntities: jsonb('key_entities').$type<{
      people?: string[];
      organizations?: string[];
      dates?: string[];
      locations?: string[];
    }>(),
    suggestedLabels: text('suggested_labels').array(),

    // Processing metadata
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    processingTimeMs: integer('processing_time_ms'),
    modelUsed: varchar('model_used', { length: 100 }),
    processingError: text('processing_error'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('processed_emails_message_idx').on(table.messageId),
    index('processed_emails_account_idx').on(table.connectedAccountId),
    index('processed_emails_needs_action_idx').on(table.needsAction),
    index('processed_emails_actionable_by_idx').on(table.actionableBy),
    index('processed_emails_received_idx').on(table.receivedDate),
    index('processed_emails_processed_idx').on(table.processedAt),
  ]
);

export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  models: many(aiModels),
}));

export const aiModelsRelations = relations(aiModels, ({ one, many }) => ({
  provider: one(aiProviders, {
    fields: [aiModels.providerId],
    references: [aiProviders.id],
  }),
  capabilities: many(modelCapabilities),
  agents: many(agents),
}));

export const modelCapabilitiesRelations = relations(modelCapabilities, ({ one }) => ({
  model: one(aiModels, {
    fields: [modelCapabilities.modelId],
    references: [aiModels.id],
  }),
}));

export const toolCategoriesRelations = relations(toolCategories, ({ many }) => ({
  tools: many(tools),
}));

export const oauthProvidersRelations = relations(oauthProviders, ({ many }) => ({
  tools: many(tools),
  connectedAccounts: many(connectedAccounts),
}));

export const toolsRelations = relations(tools, ({ one, many }) => ({
  category: one(toolCategories, {
    fields: [tools.categoryId],
    references: [toolCategories.id],
  }),
  oauthProvider: one(oauthProviders, {
    fields: [tools.oauthProviderId],
    references: [oauthProviders.id],
  }),
  agentTools: many(agentTools),
  agentConnectedAccounts: many(agentConnectedAccounts),
  actions: many(agentActions),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
  provider: one(oauthProviders, {
    fields: [connectedAccounts.providerId],
    references: [oauthProviders.id],
  }),
  agentConnectedAccounts: many(agentConnectedAccounts),
  processedEmails: many(processedEmails),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  model: one(aiModels, {
    fields: [agents.modelId],
    references: [aiModels.id],
  }),
  agentTools: many(agentTools),
  agentConnectedAccounts: many(agentConnectedAccounts),
  runs: many(agentRuns),
  feedItems: many(feedItems),
}));

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  agent: one(agents, {
    fields: [agentTools.agentId],
    references: [agents.id],
  }),
  tool: one(tools, {
    fields: [agentTools.toolId],
    references: [tools.id],
  }),
}));

export const agentConnectedAccountsRelations = relations(
  agentConnectedAccounts,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentConnectedAccounts.agentId],
      references: [agents.id],
    }),
    connectedAccount: one(connectedAccounts, {
      fields: [agentConnectedAccounts.connectedAccountId],
      references: [connectedAccounts.id],
    }),
    tool: one(tools, {
      fields: [agentConnectedAccounts.toolId],
      references: [tools.id],
    }),
  })
);

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentRuns.agentId],
    references: [agents.id],
  }),
  actions: many(agentActions),
  feedItems: many(feedItems),
}));

export const agentActionsRelations = relations(agentActions, ({ one, many }) => ({
  run: one(agentRuns, {
    fields: [agentActions.runId],
    references: [agentRuns.id],
  }),
  tool: one(tools, {
    fields: [agentActions.toolId],
    references: [tools.id],
  }),
  feedItems: many(feedItems),
  approvalLogs: many(approvalLogs),
}));

export const feedItemsRelations = relations(feedItems, ({ one, many }) => ({
  action: one(agentActions, {
    fields: [feedItems.actionId],
    references: [agentActions.id],
  }),
  agent: one(agents, {
    fields: [feedItems.agentId],
    references: [agents.id],
  }),
  run: one(agentRuns, {
    fields: [feedItems.runId],
    references: [agentRuns.id],
  }),
  approvalLogs: many(approvalLogs),
}));

export const approvalLogsRelations = relations(approvalLogs, ({ one }) => ({
  feedItem: one(feedItems, {
    fields: [approvalLogs.feedItemId],
    references: [feedItems.id],
  }),
  action: one(agentActions, {
    fields: [approvalLogs.actionId],
    references: [agentActions.id],
  }),
}));

export const processedEmailsRelations = relations(processedEmails, ({ one }) => ({
  connectedAccount: one(connectedAccounts, {
    fields: [processedEmails.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));

export type AiProvider = typeof aiProviders.$inferSelect;
export type NewAiProvider = typeof aiProviders.$inferInsert;
export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
export type ModelCapability = typeof modelCapabilities.$inferSelect;
export type NewModelCapability = typeof modelCapabilities.$inferInsert;
export type ToolCategory = typeof toolCategories.$inferSelect;
export type NewToolCategory = typeof toolCategories.$inferInsert;
export type OauthProvider = typeof oauthProviders.$inferSelect;
export type NewOauthProvider = typeof oauthProviders.$inferInsert;
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentTool = typeof agentTools.$inferSelect;
export type NewAgentTool = typeof agentTools.$inferInsert;
export type AgentConnectedAccount = typeof agentConnectedAccounts.$inferSelect;
export type NewAgentConnectedAccount = typeof agentConnectedAccounts.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type AgentAction = typeof agentActions.$inferSelect;
export type NewAgentAction = typeof agentActions.$inferInsert;
export type FeedItem = typeof feedItems.$inferSelect;
export type NewFeedItem = typeof feedItems.$inferInsert;
export type ApprovalLog = typeof approvalLogs.$inferSelect;
export type NewApprovalLog = typeof approvalLogs.$inferInsert;
export type EventLog = typeof eventLogs.$inferSelect;
export type NewEventLog = typeof eventLogs.$inferInsert;
export type ProcessedEmail = typeof processedEmails.$inferSelect;
export type NewProcessedEmail = typeof processedEmails.$inferInsert;
