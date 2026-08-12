CREATE INDEX "food_posts_status_window_end_idx" ON "food_posts" USING btree ("status","pickup_window_end");--> statement-breakpoint
CREATE INDEX "food_posts_poster_id_idx" ON "food_posts" USING btree ("poster_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pickup_requests_post_id_idx" ON "pickup_requests" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "pickup_requests_picker_id_idx" ON "pickup_requests" USING btree ("picker_id");