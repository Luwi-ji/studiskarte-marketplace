CREATE TABLE "job_run" (
	"name" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone NOT NULL,
	"last_finished_at" timestamp with time zone,
	"last_status" text NOT NULL,
	"last_detail" text
);
--> statement-breakpoint
CREATE TABLE "post_view" (
	"post_id" uuid NOT NULL,
	"viewer_id" text NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "post_view_post_id_viewer_id_day_pk" PRIMARY KEY("post_id","viewer_id","day")
);
--> statement-breakpoint
ALTER TABLE "post_view" ADD CONSTRAINT "post_view_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_view" ADD CONSTRAINT "post_view_viewer_id_student_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_expiry_idx" ON "post" USING btree ("status","expires_at");