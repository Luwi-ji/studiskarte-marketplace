CREATE TABLE "image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"purpose" text NOT NULL,
	"key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_key_unique" UNIQUE("key"),
	CONSTRAINT "image_thumb_key_unique" UNIQUE("thumb_key"),
	CONSTRAINT "image_purpose" CHECK ("image"."purpose" in ('post_photo'))
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"listed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_kind" CHECK ("post"."kind" in ('showcase', 'wishlist')),
	CONSTRAINT "post_status" CHECK ("post"."status" in ('open', 'reserved', 'fulfilled', 'withdrawn', 'expired', 'hidden', 'removed')),
	CONSTRAINT "post_title_length" CHECK (char_length(btrim("post"."title")) between 1 and 120),
	CONSTRAINT "post_open_expiry" CHECK ("post"."status" <> 'open' or "post"."expires_at" > "post"."listed_at")
);
--> statement-breakpoint
CREATE TABLE "post_photo" (
	"post_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "post_photo_post_id_image_id_pk" PRIMARY KEY("post_id","image_id"),
	CONSTRAINT "post_photo_position" UNIQUE("post_id","position"),
	CONSTRAINT "post_photo_position_nonneg" CHECK ("post_photo"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"school_domain" text NOT NULL,
	"account_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_email_unique" UNIQUE("email"),
	CONSTRAINT "student_email_school" CHECK ("student"."email" ~ '^[^@]+@([a-z0-9-]+\.)+edu\.ph$'),
	CONSTRAINT "student_email_lower" CHECK ("student"."email" = lower("student"."email")),
	CONSTRAINT "student_account_status" CHECK ("student"."account_status" in ('active', 'suspended', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_owner_id_student_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_owner_id_student_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_photo" ADD CONSTRAINT "post_photo_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_photo" ADD CONSTRAINT "post_photo_image_id_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_owner_idx" ON "post" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "post_feed_idx" ON "post" USING btree ("status","listed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rate_limit_event_lookup_idx" ON "rate_limit_event" USING btree ("action","key","created_at");--> statement-breakpoint
CREATE INDEX "session_student_idx" ON "session" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");