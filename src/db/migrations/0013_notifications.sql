CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" text NOT NULL,
	"type" text NOT NULL,
	"post_id" uuid,
	"conversation_id" uuid,
	"count" integer DEFAULT 1 NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fold_key" text,
	"once_key" text,
	CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired')),
	CONSTRAINT "notification_count" CHECK ("notification"."count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_student_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_fold_idx" ON "notification" USING btree ("recipient_id","type","fold_key") WHERE "notification"."read_at" is null and "notification"."fold_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_once_idx" ON "notification" USING btree ("recipient_id","once_key") WHERE "notification"."once_key" is not null;--> statement-breakpoint
CREATE INDEX "notification_list_idx" ON "notification" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "push_subscription_student_idx" ON "push_subscription" USING btree ("student_id");