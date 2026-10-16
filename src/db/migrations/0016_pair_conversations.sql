-- One conversation per pair of students, however many listings they deal about.
-- Existing conversations (one per post and buyer) are merged per pair: every
-- message, offer, notification and read position is kept.

CREATE TABLE "conversation_listing" (
	"conversation_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_listing_conversation_id_post_id_pk" PRIMARY KEY("conversation_id","post_id")
);
--> statement-breakpoint
-- Rules that name the columns being replaced go first, and the one-pending-offer
-- index too: merging moves several pending offers into one conversation.
DROP TRIGGER conversation_rules ON conversation;
--> statement-breakpoint
DROP FUNCTION conversation_rules();
--> statement-breakpoint
DROP INDEX "offer_one_pending_idx";
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "participant_a" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "participant_b" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "a_read_up_to" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "b_read_up_to" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "post_id" uuid;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "post_id" uuid;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "responder_id" text;
--> statement-breakpoint
-- Offers now say which listing and which buyer themselves.
UPDATE "offer" o SET post_id = c.post_id, responder_id = c.responder_id
  FROM "conversation" c WHERE c.id = o.conversation_id;
--> statement-breakpoint
-- The pair, in a fixed order (plain byte order, the same as comparing strings in code), with each side's read position.
UPDATE "conversation" c SET
    participant_a = LEAST(c.responder_id COLLATE "C", p.owner_id COLLATE "C"),
    participant_b = GREATEST(c.responder_id COLLATE "C", p.owner_id COLLATE "C"),
    a_read_up_to = CASE WHEN c.responder_id COLLATE "C" < p.owner_id COLLATE "C" THEN c.responder_read_up_to ELSE c.owner_read_up_to END,
    b_read_up_to = CASE WHEN c.responder_id COLLATE "C" < p.owner_id COLLATE "C" THEN c.owner_read_up_to ELSE c.responder_read_up_to END
  FROM "post" p WHERE p.id = c.post_id;
--> statement-breakpoint
-- Each old conversation's listing becomes a listing of its thread.
INSERT INTO "conversation_listing" (conversation_id, post_id, created_at)
  SELECT id, post_id, created_at FROM "conversation";
--> statement-breakpoint
UPDATE "message" m SET post_id = o.post_id FROM "offer" o WHERE o.id = m.offer_id;
--> statement-breakpoint
-- Merge the conversations of the same pair into the earliest one.
WITH canon AS (
  SELECT c.id AS old_id,
         (SELECT c2.id FROM "conversation" c2
            WHERE c2.participant_a = c.participant_a AND c2.participant_b = c.participant_b
            ORDER BY c2.created_at, c2.id LIMIT 1) AS new_id
  FROM "conversation" c
)
UPDATE "message" SET conversation_id = canon.new_id
  FROM canon WHERE "message".conversation_id = canon.old_id AND canon.old_id <> canon.new_id;
--> statement-breakpoint
WITH canon AS (
  SELECT c.id AS old_id,
         (SELECT c2.id FROM "conversation" c2
            WHERE c2.participant_a = c.participant_a AND c2.participant_b = c.participant_b
            ORDER BY c2.created_at, c2.id LIMIT 1) AS new_id
  FROM "conversation" c
)
UPDATE "offer" SET conversation_id = canon.new_id
  FROM canon WHERE "offer".conversation_id = canon.old_id AND canon.old_id <> canon.new_id;
--> statement-breakpoint
WITH canon AS (
  SELECT c.id AS old_id,
         (SELECT c2.id FROM "conversation" c2
            WHERE c2.participant_a = c.participant_a AND c2.participant_b = c.participant_b
            ORDER BY c2.created_at, c2.id LIMIT 1) AS new_id
  FROM "conversation" c
)
UPDATE "notification" SET conversation_id = canon.new_id
  FROM canon WHERE "notification".conversation_id = canon.old_id AND canon.old_id <> canon.new_id;
--> statement-breakpoint
WITH canon AS (
  SELECT c.id AS old_id,
         (SELECT c2.id FROM "conversation" c2
            WHERE c2.participant_a = c.participant_a AND c2.participant_b = c.participant_b
            ORDER BY c2.created_at, c2.id LIMIT 1) AS new_id
  FROM "conversation" c
)
UPDATE "conversation_listing" SET conversation_id = canon.new_id
  FROM canon WHERE "conversation_listing".conversation_id = canon.old_id AND canon.old_id <> canon.new_id;
--> statement-breakpoint
-- The kept conversation reads as far as the furthest of the merged ones, and is as recent as the newest.
UPDATE "conversation" c SET a_read_up_to = g.a, b_read_up_to = g.b, last_message_at = g.latest
  FROM (
    SELECT participant_a, participant_b, max(a_read_up_to) AS a, max(b_read_up_to) AS b, max(last_message_at) AS latest
    FROM "conversation" GROUP BY participant_a, participant_b
  ) g
  WHERE c.participant_a = g.participant_a AND c.participant_b = g.participant_b;
--> statement-breakpoint
DELETE FROM "conversation" c WHERE c.id <> (
  SELECT c2.id FROM "conversation" c2
    WHERE c2.participant_a = c.participant_a AND c2.participant_b = c.participant_b
    ORDER BY c2.created_at, c2.id LIMIT 1);
--> statement-breakpoint
ALTER TABLE "conversation" ALTER COLUMN "participant_a" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ALTER COLUMN "participant_b" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" ALTER COLUMN "post_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" ALTER COLUMN "responder_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_post_responder";--> statement-breakpoint
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_post_id_post_id_fk";--> statement-breakpoint
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_responder_id_student_id_fk";--> statement-breakpoint
DROP INDEX "conversation_responder_idx";--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "post_id";--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "responder_id";--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "owner_read_up_to";--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "responder_read_up_to";
--> statement-breakpoint
ALTER TABLE "conversation_listing" ADD CONSTRAINT "conversation_listing_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_listing" ADD CONSTRAINT "conversation_listing_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_listing_post_idx" ON "conversation_listing" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_participant_a_student_id_fk" FOREIGN KEY ("participant_a") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_participant_b_student_id_fk" FOREIGN KEY ("participant_b") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_responder_id_student_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_a_idx" ON "conversation" USING btree ("participant_a","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversation_b_idx" ON "conversation" USING btree ("participant_b","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offer_post_idx" ON "offer" USING btree ("post_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_one_pending_idx" ON "offer" USING btree ("post_id","responder_id") WHERE "offer"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_pair" UNIQUE("participant_a","participant_b");--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_ordered_pair" CHECK ("conversation"."participant_a" < "conversation"."participant_b" COLLATE "C");
--> statement-breakpoint
-- A message has text, pictures, a listing card, an offer card, or any mix, never none.
CREATE OR REPLACE FUNCTION message_require_content() RETURNS trigger AS $$
BEGIN
  IF NEW.body IS NULL AND NEW.offer_id IS NULL AND NEW.post_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM message_image WHERE message_id = NEW.id) THEN
    RAISE EXCEPTION 'message % has no text, picture, listing or offer', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Only the two people in a thread write in it. An offer card is the responder's own offer
-- in this thread; a listing card is about a listing owned by one of the two.
CREATE OR REPLACE FUNCTION message_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation c
    WHERE c.id = NEW.conversation_id AND NEW.sender_id IN (c.participant_a, c.participant_b)
  ) THEN
    RAISE EXCEPTION 'the sender is not in this conversation'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.offer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM offer o
    WHERE o.id = NEW.offer_id AND o.conversation_id = NEW.conversation_id
      AND o.responder_id = NEW.sender_id AND o.post_id IS NOT DISTINCT FROM NEW.post_id
  ) THEN
    RAISE EXCEPTION 'an offer card must be the sender''s own offer in this conversation'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM conversation c JOIN post p ON p.id = NEW.post_id
    WHERE c.id = NEW.conversation_id AND p.owner_id IN (c.participant_a, c.participant_b)
  ) THEN
    RAISE EXCEPTION 'a listing card must be about a listing of one of the two people'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- A thread's listings are listings of one of its two people.
CREATE FUNCTION conversation_listing_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation c JOIN post p ON p.id = NEW.post_id
    WHERE c.id = NEW.conversation_id AND p.owner_id IN (c.participant_a, c.participant_b)
  ) THEN
    RAISE EXCEPTION 'a thread can only be about a listing of one of its two people'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER conversation_listing_rules
  BEFORE INSERT ON conversation_listing
  FOR EACH ROW EXECUTE FUNCTION conversation_listing_rules();
--> statement-breakpoint
-- An offer is by someone other than the post's owner, in the thread between the two of them.
CREATE FUNCTION offer_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation c JOIN post p ON p.id = NEW.post_id
    WHERE c.id = NEW.conversation_id
      AND NEW.responder_id <> p.owner_id
      AND ((c.participant_a = p.owner_id AND c.participant_b = NEW.responder_id)
        OR (c.participant_b = p.owner_id AND c.participant_a = NEW.responder_id))
  ) THEN
    RAISE EXCEPTION 'an offer is made by someone other than the owner, in the thread between the two'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER offer_rules
  BEFORE INSERT ON offer
  FOR EACH ROW EXECUTE FUNCTION offer_rules();
--> statement-breakpoint
-- A deal is between the post's owner and the buyer whose offer was accepted.
CREATE OR REPLACE FUNCTION deal_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM offer o JOIN post p ON p.id = o.post_id
    WHERE o.id = NEW.offer_id AND p.id = NEW.post_id
      AND p.owner_id = NEW.owner_id AND o.responder_id = NEW.responder_id
  ) THEN
    RAISE EXCEPTION 'a deal is between the post''s owner and the offer''s responder'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
