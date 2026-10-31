ALTER TABLE "food_posts" ADD COLUMN "client_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "food_posts_poster_client_key_idx" ON "food_posts" USING btree ("poster_id","client_key");