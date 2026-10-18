CREATE TABLE "partner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"area" text NOT NULL,
	"school_domains" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_name_length" CHECK (char_length(btrim("partner"."name")) between 1 and 120),
	CONSTRAINT "partner_area_length" CHECK (char_length(btrim("partner"."area")) between 1 and 120),
	CONSTRAINT "partner_kind" CHECK ("partner"."kind" in ('food', 'clothes', 'printing', 'services', 'other')),
	CONSTRAINT "partner_status" CHECK ("partner"."status" in ('pending', 'active', 'paused', 'ended')),
	CONSTRAINT "partner_school_domains_not_empty" CHECK ("partner"."school_domains" is null or cardinality("partner"."school_domains") > 0)
);
--> statement-breakpoint
CREATE TABLE "perk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"terms" text NOT NULL,
	"limit_per_student" integer,
	"limit_period" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perk_title_length" CHECK (char_length(btrim("perk"."title")) between 1 and 120),
	CONSTRAINT "perk_terms_length" CHECK (char_length(btrim("perk"."terms")) between 1 and 500),
	CONSTRAINT "perk_status" CHECK ("perk"."status" in ('draft', 'live', 'paused', 'ended')),
	CONSTRAINT "perk_limit" CHECK (("perk"."limit_per_student" is null and "perk"."limit_period" is null) or ("perk"."limit_per_student" > 0 and "perk"."limit_period" in ('day', 'week', 'month', 'ever'))),
	CONSTRAINT "perk_dates" CHECK ("perk"."ends_at" is null or "perk"."ends_at" > "perk"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "perk" ADD CONSTRAINT "perk_partner_id_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perk_partner_idx" ON "perk" USING btree ("partner_id");