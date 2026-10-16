CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"responder_id" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_read_up_to" bigint DEFAULT 0 NOT NULL,
	"responder_read_up_to" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_post_responder" UNIQUE("post_id","responder_id")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_body_length" CHECK ("message"."body" is null or char_length(btrim("message"."body")) between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "message_image" (
	"message_id" bigint NOT NULL,
	"image_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "message_image_message_id_image_id_pk" PRIMARY KEY("message_id","image_id"),
	CONSTRAINT "message_image_image_id_unique" UNIQUE("image_id"),
	CONSTRAINT "message_image_position" UNIQUE("message_id","position"),
	CONSTRAINT "message_image_position_range" CHECK ("message_image"."position" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "image" DROP CONSTRAINT "image_purpose";--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_responder_id_student_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_student_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_image" ADD CONSTRAINT "message_image_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_image" ADD CONSTRAINT "message_image_image_id_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_responder_idx" ON "conversation" USING btree ("responder_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversation_id","id");--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_purpose" CHECK ("image"."purpose" in ('post_photo', 'avatar', 'message_photo'));
--> statement-breakpoint
-- A student cannot message their own post.
CREATE FUNCTION conversation_rules() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM post WHERE id = NEW.post_id AND owner_id = NEW.responder_id) THEN
    RAISE EXCEPTION 'a student cannot message their own post'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER conversation_rules
  BEFORE INSERT OR UPDATE OF post_id, responder_id ON conversation
  FOR EACH ROW EXECUTE FUNCTION conversation_rules();
--> statement-breakpoint
-- Only the two people in a conversation (the post's owner and the responder) can write in it.
CREATE FUNCTION message_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation c JOIN post p ON p.id = c.post_id
    WHERE c.id = NEW.conversation_id AND NEW.sender_id IN (c.responder_id, p.owner_id)
  ) THEN
    RAISE EXCEPTION 'the sender is not in this conversation'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER message_rules
  BEFORE INSERT ON message
  FOR EACH ROW EXECUTE FUNCTION message_rules();
--> statement-breakpoint
-- A message has text, pictures, or both. Checked at commit, so the message and its pictures are written together.
CREATE FUNCTION message_require_content() RETURNS trigger AS $$
BEGIN
  IF NEW.body IS NULL AND NOT EXISTS (SELECT 1 FROM message_image WHERE message_id = NEW.id) THEN
    RAISE EXCEPTION 'message % has no text and no picture', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER message_require_content
  AFTER INSERT ON message
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION message_require_content();
--> statement-breakpoint
-- A picture on a message is the sender's own message photo.
CREATE FUNCTION message_image_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM message m JOIN image i ON i.id = NEW.image_id
    WHERE m.id = NEW.message_id AND i.owner_id = m.sender_id AND i.purpose = 'message_photo'
  ) THEN
    RAISE EXCEPTION 'a message can only carry its sender''s own message photos'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER message_image_rules
  BEFORE INSERT ON message_image
  FOR EACH ROW EXECUTE FUNCTION message_image_rules();
