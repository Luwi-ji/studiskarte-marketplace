CREATE TABLE "id_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"event" text NOT NULL,
	"text_version" text NOT NULL,
	"policy_version" text,
	"channel" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "id_consent_event" CHECK ("id_consent"."event" in ('given', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "id_image_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"admin_id" text NOT NULL,
	"slot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "id_image_view_slot" CHECK ("id_image_view"."slot" in ('document', 'holding'))
);
--> statement-breakpoint
CREATE TABLE "id_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"document_kind" text NOT NULL,
	"claimed_role" text NOT NULL,
	"document_key" text,
	"holding_key" text,
	"submitted_at" timestamp with time zone,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "id_verification_status" CHECK ("id_verification"."status" in ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'expired')),
	CONSTRAINT "id_verification_document_kind" CHECK ("id_verification"."document_kind" in ('school_id', 'registration', 'other')),
	CONSTRAINT "id_verification_reason_length" CHECK ("id_verification"."reason" is null or char_length(btrim("id_verification"."reason")) between 1 and 300),
	CONSTRAINT "id_verification_pictures_only_while_open" CHECK ("id_verification"."status" in ('draft', 'pending') or ("id_verification"."document_key" is null and "id_verification"."holding_key" is null)),
	CONSTRAINT "id_verification_pending_has_pictures" CHECK ("id_verification"."status" <> 'pending' or ("id_verification"."document_key" is not null and "id_verification"."holding_key" is not null and "id_verification"."submitted_at" is not null)),
	CONSTRAINT "id_verification_decided" CHECK (("id_verification"."status" in ('approved', 'rejected')) = ("id_verification"."decided_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "id_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "id_check_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "id_consent" ADD CONSTRAINT "id_consent_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_image_view" ADD CONSTRAINT "id_image_view_verification_id_id_verification_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."id_verification"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_image_view" ADD CONSTRAINT "id_image_view_admin_id_student_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_verification" ADD CONSTRAINT "id_verification_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_verification" ADD CONSTRAINT "id_verification_decided_by_student_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "id_consent_student_idx" ON "id_consent" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "id_image_view_verification_idx" ON "id_image_view" USING btree ("verification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "id_verification_one_open" ON "id_verification" USING btree ("student_id") WHERE "id_verification"."status" in ('draft', 'pending');--> statement-breakpoint
CREATE INDEX "id_verification_queue_idx" ON "id_verification" USING btree ("status","submitted_at");