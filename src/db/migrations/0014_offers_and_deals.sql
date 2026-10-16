CREATE TABLE "deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"responder_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'agreed' NOT NULL,
	"handover_method" text,
	"scheduled_at" timestamp with time zone,
	"place" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_offer_id_unique" UNIQUE("offer_id"),
	CONSTRAINT "deal_status" CHECK ("deal"."status" in ('agreed', 'scheduled', 'completed', 'cancelled')),
	CONSTRAINT "deal_handover" CHECK ("deal"."handover_method" is null or "deal"."handover_method" in ('meetup', 'delivery')),
	CONSTRAINT "deal_distinct_people" CHECK ("deal"."owner_id" <> "deal"."responder_id")
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"is_reserve" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_status" CHECK ("offer"."status" in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
	CONSTRAINT "offer_amount" CHECK (("offer"."is_reserve" and "offer"."amount" between 0 and 1000000) or (not "offer"."is_reserve" and "offer"."amount" between 1 and 1000000)),
	CONSTRAINT "offer_decided" CHECK (("offer"."status" = 'pending') = ("offer"."decided_at" is null))
);
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "offer_id" uuid;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_offer_id_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_owner_id_student_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_responder_id_student_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_one_active_idx" ON "deal" USING btree ("post_id") WHERE "deal"."status" in ('agreed', 'scheduled');--> statement-breakpoint
CREATE INDEX "deal_owner_idx" ON "deal" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "deal_responder_idx" ON "deal" USING btree ("responder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_one_pending_idx" ON "offer" USING btree ("conversation_id") WHERE "offer"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "offer_conversation_idx" ON "offer" USING btree ("conversation_id","created_at");--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_offer_id_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_offer_id_unique" UNIQUE("offer_id");--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired'));
--> statement-breakpoint
-- A message may be an offer card: text, pictures, an offer, or any mix, never none.
CREATE OR REPLACE FUNCTION message_require_content() RETURNS trigger AS $$
BEGIN
  IF NEW.body IS NULL AND NEW.offer_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM message_image WHERE message_id = NEW.id) THEN
    RAISE EXCEPTION 'message % has no text, picture or offer', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Only the two people in a conversation can write in it, and only the responder
-- makes offers: an offer card must be this conversation's own offer, from the responder.
CREATE OR REPLACE FUNCTION message_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation c JOIN post p ON p.id = c.post_id
    WHERE c.id = NEW.conversation_id AND NEW.sender_id IN (c.responder_id, p.owner_id)
  ) THEN
    RAISE EXCEPTION 'the sender is not in this conversation'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.offer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM offer o JOIN conversation c ON c.id = o.conversation_id
    WHERE o.id = NEW.offer_id AND o.conversation_id = NEW.conversation_id AND c.responder_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'an offer card must be the responder''s own offer in this conversation'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- A deal is between the post's owner and the responder whose offer was accepted.
CREATE FUNCTION deal_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM offer o
    JOIN conversation c ON c.id = o.conversation_id
    JOIN post p ON p.id = c.post_id
    WHERE o.id = NEW.offer_id AND p.id = NEW.post_id
      AND p.owner_id = NEW.owner_id AND c.responder_id = NEW.responder_id
  ) THEN
    RAISE EXCEPTION 'a deal is between the post''s owner and the offer''s responder'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER deal_rules
  BEFORE INSERT ON deal
  FOR EACH ROW EXECUTE FUNCTION deal_rules();
