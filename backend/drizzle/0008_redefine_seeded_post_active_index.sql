-- The original partial unique index (0007) guarded against two concurrent
-- feed loads both provisioning a seeded post for the same demo visitor, but
-- its predicate (demo_expires_at IS NOT NULL) matched EVERY seeded post for
-- that visitor for the rest of their session — including ones already
-- requested and closed. That meant once a visitor requested their seeded
-- post (flipping it to "closed"), provisionSeededPost could never insert a
-- replacement: the unique index rejected it outright, so the feed stayed
-- empty for the remainder of the demo session. Narrowing the predicate to
-- open posts only keeps the same race protection while allowing a fresh
-- seeded post per visitor once the previous one is claimed.
DROP INDEX "food_posts_seeded_for_user_id_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "food_posts_seeded_for_user_id_active_idx" ON "food_posts" ("seeded_for_user_id") WHERE "demo_expires_at" IS NOT NULL AND "status" = 'open';
