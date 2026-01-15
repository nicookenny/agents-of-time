CREATE TYPE "public"."actionable_by" AS ENUM('human', 'ai');--> statement-breakpoint
CREATE TABLE "processed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"thread_id" varchar(255),
	"connected_account_id" uuid NOT NULL,
	"sender" varchar(500) NOT NULL,
	"subject" varchar(1000),
	"received_date" timestamp with time zone NOT NULL,
	"body_snippet" text,
	"summary" text,
	"actionables" jsonb,
	"needs_action" boolean DEFAULT false NOT NULL,
	"actionable_by" "actionable_by",
	"sentiment" varchar(50),
	"category" varchar(100),
	"priority" "priority_level" DEFAULT 'normal',
	"key_entities" jsonb,
	"suggested_labels" text[],
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_time_ms" integer,
	"model_used" varchar(100),
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_emails_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "processed_emails_message_idx" ON "processed_emails" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "processed_emails_account_idx" ON "processed_emails" USING btree ("connected_account_id");--> statement-breakpoint
CREATE INDEX "processed_emails_needs_action_idx" ON "processed_emails" USING btree ("needs_action");--> statement-breakpoint
CREATE INDEX "processed_emails_actionable_by_idx" ON "processed_emails" USING btree ("actionable_by");--> statement-breakpoint
CREATE INDEX "processed_emails_received_idx" ON "processed_emails" USING btree ("received_date");--> statement-breakpoint
CREATE INDEX "processed_emails_processed_idx" ON "processed_emails" USING btree ("processed_at");