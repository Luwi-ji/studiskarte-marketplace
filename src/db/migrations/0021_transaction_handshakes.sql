ALTER TABLE "deal" DROP CONSTRAINT "deal_completed_paid";--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "post" DROP CONSTRAINT "post_delivery_area";--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "cash_given_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "cash_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "post" DROP COLUMN "delivery_area";--> statement-breakpoint
-- Completed cash deals predate the cash handshake: count the cash as given and received when they completed.
UPDATE "deal" SET "cash_given_at" = "updated_at", "cash_received_at" = "updated_at" WHERE "status" = 'completed' AND "cash_agreed_at" IS NOT NULL AND "payment_confirmed_at" IS NULL;--> statement-breakpoint
UPDATE "deal" SET "activity_at" = "updated_at";--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_cash_given_order" CHECK ("deal"."cash_given_at" is null or "deal"."cash_agreed_at" is not null);--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_cash_received_order" CHECK ("deal"."cash_received_at" is null or "deal"."cash_given_at" is not null);--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_completed_paid" CHECK ("deal"."status" <> 'completed' or "deal"."amount" = 0 or "deal"."payment_confirmed_at" is not null or "deal"."cash_received_at" is not null);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired', 'deal_paid', 'deal_payment_confirmed', 'deal_payment_requested', 'deal_cash_requested', 'deal_cash_answered', 'deal_cash_given', 'deal_cash_received', 'deal_payment_rejected', 'deal_reported', 'deal_disputed'));