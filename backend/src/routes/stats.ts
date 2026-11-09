import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { foodPosts } from "../db/schema.js";
import { postIsVisible } from "../lib/domain/finders.js";

export const statsRoutes = new Hono();

// Recounted at most every few minutes: it's public (the home page) and only
// ever needs to be roughly current.
const CACHE_MS = 5 * 60_000;
let cached: { at: number; body: { mealsShared: number; pickups: number } } | null = null;

// Food actually handed over: pickups confirmed by the poster or the picker,
// not ones the expiry job only assumed. A post from before servings were
// asked counts as one meal.
export async function countImpact() {
  const [row] = await db
    .select({
      pickups: sql<number>`count(*)::int`,
      mealsShared: sql<number>`coalesce(sum(coalesce(${foodPosts.servings}, 1)), 0)::int`,
    })
    .from(foodPosts)
    .where(
      and(
        eq(foodPosts.status, "completed"),
        eq(foodPosts.autoCompleted, false),
        eq(foodPosts.isDemo, false),
        postIsVisible
      )
    );
  return row;
}

statsRoutes.get("/impact", async (c) => {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { at: Date.now(), body: await countImpact() };
  }
  return c.json(cached.body);
});

export function resetImpactCache() {
  cached = null;
}
