CREATE TYPE "public"."action_status" AS ENUM('pending', 'pending_approval', 'approved', 'rejected', 'executing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feed_item_status" AS ENUM('pending', 'pending_approval', 'approved', 'rejected', 'completed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."feed_item_type" AS ENUM('action_required', 'completed', 'info', 'error', 'approval_request');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('scheduled', 'manual', 'event', 'webhook');--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"tool_id" uuid,
	"action_type" varchar(100) NOT NULL,
	"action_name" varchar(200),
	"input_data" jsonb,
	"output_data" jsonb,
	"status" "action_status" DEFAULT 'pending' NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"sequence_order" integer DEFAULT 0 NOT NULL,
	"executed_at" timestamp with time zone,
	"duration_ms" integer,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "agent_connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"connected_account_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"trigger_type" "trigger_type" DEFAULT 'scheduled' NOT NULL,
	"trigger_details" jsonb,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"total_cost" numeric(10, 6) DEFAULT '0',
	"error_message" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "agent_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"configuration" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"model_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approval_threshold" varchar(50) DEFAULT 'all',
	"run_interval_seconds" integer DEFAULT 300,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"model_identifier" varchar(100) NOT NULL,
	"context_window" integer NOT NULL,
	"max_output_tokens" integer,
	"supports_vision" boolean DEFAULT false NOT NULL,
	"supports_tools" boolean DEFAULT false NOT NULL,
	"cost_per_1k_input" numeric(10, 6),
	"cost_per_1k_output" numeric(10, 6),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"api_base_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "approval_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_item_id" uuid NOT NULL,
	"action_id" uuid,
	"decision" varchar(50) NOT NULL,
	"reason" text,
	"modifications" jsonb,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"account_identifier" varchar(255) NOT NULL,
	"account_email" varchar(255),
	"account_name" varchar(255),
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes_granted" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"source_id" uuid,
	"payload" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid,
	"agent_id" uuid NOT NULL,
	"run_id" uuid,
	"item_type" "feed_item_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "feed_item_status" DEFAULT 'pending' NOT NULL,
	"priority" "priority_level" DEFAULT 'normal' NOT NULL,
	"metadata" jsonb,
	"proposed_action" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "model_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"capability_type" varchar(50) NOT NULL,
	"capability_value" varchar(200) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "oauth_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"auth_url" varchar(500) NOT NULL,
	"token_url" varchar(500) NOT NULL,
	"scopes" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tool_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "tool_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"name" varchar(100) NOT NULL,
	"identifier" varchar(100) NOT NULL,
	"description" text,
	"config_schema" jsonb,
	"requires_oauth" boolean DEFAULT false NOT NULL,
	"oauth_provider_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tools_name_unique" UNIQUE("name"),
	CONSTRAINT "tools_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connected_accounts" ADD CONSTRAINT "agent_connected_accounts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connected_accounts" ADD CONSTRAINT "agent_connected_accounts_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connected_accounts" ADD CONSTRAINT "agent_connected_accounts_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_action_id_agent_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."agent_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_provider_id_oauth_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."oauth_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_action_id_agent_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."agent_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_capabilities" ADD CONSTRAINT "model_capabilities_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_category_id_tool_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tool_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_oauth_provider_id_oauth_providers_id_fk" FOREIGN KEY ("oauth_provider_id") REFERENCES "public"."oauth_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_actions_run_idx" ON "agent_actions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_actions_tool_idx" ON "agent_actions" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "agent_actions_status_idx" ON "agent_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_actions_sequence_idx" ON "agent_actions" USING btree ("run_id","sequence_order");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_connected_accounts_unique_idx" ON "agent_connected_accounts" USING btree ("agent_id","connected_account_id","tool_id");--> statement-breakpoint
CREATE INDEX "agent_connected_accounts_agent_idx" ON "agent_connected_accounts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_connected_accounts_account_idx" ON "agent_connected_accounts" USING btree ("connected_account_id");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_runs_started_idx" ON "agent_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tools_unique_idx" ON "agent_tools" USING btree ("agent_id","tool_id");--> statement-breakpoint
CREATE INDEX "agent_tools_agent_idx" ON "agent_tools" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_tools_tool_idx" ON "agent_tools" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "agents_model_idx" ON "agents" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "agents_active_idx" ON "agents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agents_last_run_idx" ON "agents" USING btree ("last_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_provider_identifier_idx" ON "ai_models" USING btree ("provider_id","model_identifier");--> statement-breakpoint
CREATE INDEX "ai_models_provider_idx" ON "ai_models" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "ai_models_active_idx" ON "ai_models" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "approval_logs_feed_item_idx" ON "approval_logs" USING btree ("feed_item_id");--> statement-breakpoint
CREATE INDEX "approval_logs_action_idx" ON "approval_logs" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "approval_logs_decided_idx" ON "approval_logs" USING btree ("decided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_accounts_provider_identifier_idx" ON "connected_accounts" USING btree ("provider_id","account_identifier");--> statement-breakpoint
CREATE INDEX "connected_accounts_provider_idx" ON "connected_accounts" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "connected_accounts_active_idx" ON "connected_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "connected_accounts_expires_idx" ON "connected_accounts" USING btree ("token_expires_at");--> statement-breakpoint
CREATE INDEX "event_logs_type_idx" ON "event_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "event_logs_source_idx" ON "event_logs" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "event_logs_unprocessed_idx" ON "event_logs" USING btree ("processed","created_at");--> statement-breakpoint
CREATE INDEX "event_logs_created_idx" ON "event_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feed_items_agent_idx" ON "feed_items" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "feed_items_action_idx" ON "feed_items" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "feed_items_run_idx" ON "feed_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "feed_items_status_idx" ON "feed_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feed_items_type_idx" ON "feed_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "feed_items_created_idx" ON "feed_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feed_items_priority_idx" ON "feed_items" USING btree ("priority","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "model_capabilities_unique_idx" ON "model_capabilities" USING btree ("model_id","capability_type","capability_value");--> statement-breakpoint
CREATE INDEX "model_capabilities_model_idx" ON "model_capabilities" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "model_capabilities_type_idx" ON "model_capabilities" USING btree ("capability_type");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "tools_oauth_provider_idx" ON "tools" USING btree ("oauth_provider_id");