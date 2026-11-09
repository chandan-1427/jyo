ALTER TABLE "food_posts" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;