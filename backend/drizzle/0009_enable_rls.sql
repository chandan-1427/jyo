-- Enable Row Level Security on all tables. No policies are defined, so this
-- is a default-deny: anon/authenticated Postgres roles (used by Supabase's
-- auto-generated REST API and Realtime, both reachable with the public
-- anon key) get zero access. The backend connects as the `postgres` role,
-- which owns these tables and bypasses RLS, so app behavior is unaffected.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pickup_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
