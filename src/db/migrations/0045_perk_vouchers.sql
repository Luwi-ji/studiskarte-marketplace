CREATE TABLE "perk_voucher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perk_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "perk_voucher_code" UNIQUE("code"),
	CONSTRAINT "perk_voucher_status" CHECK ("perk_voucher"."status" in ('claimed', 'redeemed', 'expired')),
	CONSTRAINT "perk_voucher_redeemed_at" CHECK (("perk_voucher"."status" = 'redeemed') = ("perk_voucher"."redeemed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "partner" ADD COLUMN "pin" text;--> statement-breakpoint
ALTER TABLE "partner" ADD COLUMN "report_token" text;--> statement-breakpoint
ALTER TABLE "perk" ADD COLUMN "total_quantity" integer;--> statement-breakpoint
ALTER TABLE "perk_voucher" ADD CONSTRAINT "perk_voucher_perk_id_perk_id_fk" FOREIGN KEY ("perk_id") REFERENCES "public"."perk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_voucher" ADD CONSTRAINT "perk_voucher_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "perk_voucher_one_open" ON "perk_voucher" USING btree ("perk_id","student_id") WHERE "perk_voucher"."status" = 'claimed';--> statement-breakpoint
CREATE INDEX "perk_voucher_lookup_idx" ON "perk_voucher" USING btree ("perk_id","student_id","claimed_at");--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_report_token" UNIQUE("report_token");--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_pin_format" CHECK ("partner"."pin" is null or "partner"."pin" ~ '^[0-9]{4}$');--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_report_token_format" CHECK ("partner"."report_token" is null or "partner"."report_token" ~ '^[A-Za-z0-9_-]{32}$');--> statement-breakpoint
ALTER TABLE "perk" ADD CONSTRAINT "perk_total_quantity" CHECK ("perk"."total_quantity" is null or "perk"."total_quantity" > 0);