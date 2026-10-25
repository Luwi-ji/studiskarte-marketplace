CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_message_lengths" CHECK (char_length("contact_message"."email") <= 120 and char_length("contact_message"."message") between 1 and 4000 and ("contact_message"."name" is null or char_length("contact_message"."name") <= 60))
);
--> statement-breakpoint
CREATE INDEX "contact_message_created_idx" ON "contact_message" USING btree ("created_at");