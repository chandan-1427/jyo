ALTER TABLE "food_posts" ADD COLUMN "seeded_for_user_id" uuid;--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "demo_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "demo_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "demo_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "food_posts" ADD CONSTRAINT "food_posts_seeded_for_user_id_users_id_fk" FOREIGN KEY ("seeded_for_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Guards concurrent feed loads from both provisioning a seeded post for the
-- same demo visitor — only one active (non-cleaned-up) seeded post per user.
CREATE UNIQUE INDEX "food_posts_seeded_for_user_id_active_idx" ON "food_posts" ("seeded_for_user_id") WHERE "demo_expires_at" IS NOT NULL;