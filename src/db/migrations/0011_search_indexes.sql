CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "post_title_trgm_idx" ON "post" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "post_description_trgm_idx" ON "post" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "student_handle_trgm_idx" ON "student" USING gin ("handle" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "student_name_trgm_idx" ON "student" USING gin ("name" gin_trgm_ops);