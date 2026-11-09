import { Hono } from "hono";
import { z } from "zod";
import { aliasedTable, and, desc, eq, ilike, isNull, isNotNull, notInArray, notLike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, reports, users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { userLimiter } from "../middleware/limiters.js";
import { parseJsonBody, parseQuery } from "../lib/http.js";
import { isValidUuid } from "../lib/domain/finders.js";
import { removeAllSubscriptions } from "../lib/notifications/push.js";
import { broadcastFeedChange, closeUserStreams } from "../lib/notifications/notificationStream.js";
import { countImpact } from "./stats.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";

export const adminRoutes = new Hono();

// To anyone but an admin, the admin API doesn't exist.
adminRoutes.use("*", authMiddleware, userLimiter, async (c, next) => {
  if (!c.get("user").isAdmin) return c.json({ error: "Not found" }, 404);
  await next();
});

// Every admin action is logged with who did it, so there's a record.
const audit = (adminId: string, action: string, details: Record<string, unknown>) =>
  logger.info({ adminId, action, ...details }, `Admin: ${action}`);

const notDemoAccount = notLike(users.email, "%@jyo.internal");
const reporter = aliasedTable(users, "reporter");
const reported = aliasedTable(users, "reported");

const reportsAgainst = sql<number>`(select count(*)::int from ${reports} r where r.reported_user_id = "users"."id")`;

// --- Overview ---
adminRoutes.get("/overview", async (c) => {
  const [people] = await db
    .select({
      people: sql<number>`(count(*) filter (where not ${users.isDeleted}))::int`,
      suspended: sql<number>`(count(*) filter (where ${users.suspendedAt} is not null))::int`,
    })
    .from(users)
    .where(and(notDemoAccount, eq(users.isDemo, false)));
  const [posts] = await db
    .select({ activePosts: sql<number>`count(*)::int` })
    .from(foodPosts)
    .where(
      and(
        eq(foodPosts.isDemo, false),
        isNull(foodPosts.removedAt),
        sql`${foodPosts.status} in ('open', 'pending_approval', 'closed')`
      )
    );
  const [open] = await db.select({ openReports: sql<number>`count(*)::int` }).from(reports).where(isNull(reports.resolvedAt));
  const impact = await countImpact();

  // The last 30 days against the 30 before, for the trend on each card.
  const [trends] = await db.execute<{
    people_now: number;
    people_before: number;
    posts_now: number;
    posts_before: number;
    requests_now: number;
    requests_before: number;
  }>(sql`
    select
      (select count(*)::int from ${users} u where not u.is_demo and u.email not like '%@jyo.internal' and u.created_at >= now() - interval '30 days') as people_now,
      (select count(*)::int from ${users} u where not u.is_demo and u.email not like '%@jyo.internal' and u.created_at >= now() - interval '60 days' and u.created_at < now() - interval '30 days') as people_before,
      (select count(*)::int from ${foodPosts} fp where not fp.is_demo and fp.created_at >= now() - interval '30 days') as posts_now,
      (select count(*)::int from ${foodPosts} fp where not fp.is_demo and fp.created_at >= now() - interval '60 days' and fp.created_at < now() - interval '30 days') as posts_before,
      (select count(*)::int from ${pickupRequests} pr where not pr.is_demo and pr.created_at >= now() - interval '30 days') as requests_now,
      (select count(*)::int from ${pickupRequests} pr where not pr.is_demo and pr.created_at >= now() - interval '60 days' and pr.created_at < now() - interval '30 days') as requests_before
  `);

  return c.json({
    ...people,
    ...posts,
    ...open,
    ...impact,
    last30Days: {
      people: { now: trends.people_now, before: trends.people_before },
      posts: { now: trends.posts_now, before: trends.posts_before },
      requests: { now: trends.requests_now, before: trends.requests_before },
    },
  });
});

// --- Activity per day, for the chart ---
// Days in Indian time (timestamps are stored in UTC), oldest first, with
// days that had nothing as zeros. Demo content is left out.
const activityQuery = z.object({ days: z.enum(["7", "30", "90"]).default("90") });

adminRoutes.get("/activity", async (c) => {
  const query = parseQuery(c, activityQuery);
  if (!query.ok) return query.response;
  const days = Number(query.data.days);

  const rows = await db.execute<{ date: string; posts: number; requests: number }>(sql`
    with ist as (select (now() at time zone 'UTC' + interval '5 hours 30 minutes')::date as today)
    select to_char(d, 'YYYY-MM-DD') as date,
      (select count(*)::int from ${foodPosts} fp
        where not fp.is_demo and (fp.created_at + interval '5 hours 30 minutes')::date = d) as posts,
      (select count(*)::int from ${pickupRequests} pr
        where not pr.is_demo and (pr.created_at + interval '5 hours 30 minutes')::date = d) as requests
    from ist, generate_series((ist.today - ${days - 1}::int)::timestamp, ist.today::timestamp, interval '1 day') as g(ts), lateral (select g.ts::date as d) x
    order by d
  `);

  return c.json({ days: rows });
});

// --- Reports ---
const reportsQuery = z.object({ status: z.enum(["open", "resolved"]).default("open") });

adminRoutes.get("/reports", async (c) => {
  const query = parseQuery(c, reportsQuery);
  if (!query.ok) return query.response;

  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      details: reports.details,
      postId: reports.postId,
      postTitle: reports.postTitle,
      postRemoved: sql<boolean>`(${foodPosts.removedAt} is not null)`,
      createdAt: reports.createdAt,
      resolvedAt: reports.resolvedAt,
      reporter: { id: reporter.id, name: reporter.name, email: reporter.email },
      reported: {
        id: reported.id,
        name: reported.name,
        email: reported.email,
        suspendedAt: reported.suspendedAt,
        isDeleted: reported.isDeleted,
      },
      reportsAgainst: sql<number>`(select count(*)::int from ${reports} r2 where r2.reported_user_id = ${reported.id})`,
    })
    .from(reports)
    .innerJoin(reporter, eq(reports.reporterId, reporter.id))
    .innerJoin(reported, eq(reports.reportedUserId, reported.id))
    .leftJoin(foodPosts, eq(reports.postId, foodPosts.id))
    .where(query.data.status === "open" ? isNull(reports.resolvedAt) : isNotNull(reports.resolvedAt))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  return c.json({ reports: rows });
});

adminRoutes.post("/reports/:id/resolve", async (c) => {
  const reportId = c.req.param("id");
  if (!isValidUuid(reportId)) return c.json({ error: "Report not found" }, 404);
  const [row] = await db.select({ id: reports.id }).from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!row) return c.json({ error: "Report not found" }, 404);

  await db.update(reports).set({ resolvedAt: new Date() }).where(and(eq(reports.id, reportId), isNull(reports.resolvedAt)));
  audit(c.get("user").userId, "resolve report", { reportId });
  return c.json({ message: "Resolved" });
});

// --- People ---
// Numbered pages, newest first: an admin table is read by page ("21–40 of
// 42"), and the people list barely changes while it's being read.
export const PEOPLE_PAGE_SIZE = 20;
const usersQuery = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  status: z.enum(["active", "suspended"]).default("active"),
});

adminRoutes.get("/users", async (c) => {
  const query = parseQuery(c, usersQuery);
  if (!query.ok) return query.response;
  const term = query.data.search ? `%${query.data.search.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%` : null;
  const { page, status } = query.data;
  const suspended = status === "suspended";
  // Admins aren't moderated from here (they can't be suspended), so they're
  // left out like demo samples.
  const matching = and(
    notDemoAccount,
    env.ADMIN_EMAILS.length ? notInArray(sql`lower(${users.email})`, env.ADMIN_EMAILS) : undefined,
    suspended ? isNotNull(users.suspendedAt) : isNull(users.suspendedAt),
    term ? or(ilike(users.name, term), ilike(users.email, term)) : undefined
  );

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      emailVerified: users.emailVerified,
      isDeleted: users.isDeleted,
      suspendedAt: users.suspendedAt,
      suspendedReason: users.suspendedReason,
      createdAt: users.createdAt,
      posts: sql<number>`(select count(*)::int from ${foodPosts} fp where fp.poster_id = "users"."id" and not fp.is_demo)`,
      requests: sql<number>`(select count(*)::int from ${pickupRequests} pr where pr.picker_id = "users"."id" and not pr.is_demo)`,
      reportsAgainst,
    })
    .from(users)
    .where(matching)
    .orderBy(desc(suspended ? users.suspendedAt : users.createdAt), desc(users.id))
    .limit(PEOPLE_PAGE_SIZE)
    .offset((page - 1) * PEOPLE_PAGE_SIZE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(matching);

  return c.json({
    users: rows.map((u) => ({ ...u, isAdmin: env.ADMIN_EMAILS.includes(u.email.toLowerCase()) })),
    page,
    pageSize: PEOPLE_PAGE_SIZE,
    total,
  });
});

const suspendSchema = z.object({
  reason: z.string().trim().min(3, "Note why, for the record").max(500, "Keep it under 500 characters"),
});

// Ends every session at once (the token version moves on), stops their
// notifications and live updates, and hides their posts everywhere.
adminRoutes.post("/users/:id/suspend", async (c) => {
  const adminId = c.get("user").userId;
  const userId = c.req.param("id");
  if (!isValidUuid(userId)) return c.json({ error: "Person not found" }, 404);
  const parsed = await parseJsonBody(c, suspendSchema);
  if (!parsed.ok) return parsed.response;

  const [target] = await db.select({ id: users.id, email: users.email, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return c.json({ error: "Person not found" }, 404);
  if (target.id === adminId || env.ADMIN_EMAILS.includes(target.email.toLowerCase())) {
    return c.json({ error: "Admins can't be suspended here. Remove the address from ADMIN_EMAILS first." }, 403);
  }
  if (target.suspendedAt) return c.json({ message: "Suspended" });

  const [done] = await db
    .update(users)
    .set({ suspendedAt: new Date(), suspendedReason: parsed.data.reason, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(and(eq(users.id, userId), isNull(users.suspendedAt)))
    .returning({ id: users.id });

  if (done) {
    await removeAllSubscriptions(userId);
    closeUserStreams(userId);
    broadcastFeedChange();
    audit(adminId, "suspend", { userId, reason: parsed.data.reason });
  }
  return c.json({ message: "Suspended" });
});

adminRoutes.post("/users/:id/unsuspend", async (c) => {
  const userId = c.req.param("id");
  if (!isValidUuid(userId)) return c.json({ error: "Person not found" }, 404);
  const [done] = await db
    .update(users)
    .set({ suspendedAt: null, suspendedReason: null })
    .where(and(eq(users.id, userId), isNotNull(users.suspendedAt)))
    .returning({ id: users.id });
  if (done) {
    broadcastFeedChange();
    audit(c.get("user").userId, "unsuspend", { userId });
  }
  return c.json({ message: "Unsuspended" });
});

// --- Posts ---
// Hidden everywhere from then on, for everyone including the poster.
adminRoutes.post("/posts/:id/remove", async (c) => {
  const postId = c.req.param("id");
  if (!isValidUuid(postId)) return c.json({ error: "Post not found" }, 404);
  const [post] = await db.select({ id: foodPosts.id }).from(foodPosts).where(eq(foodPosts.id, postId)).limit(1);
  if (!post) return c.json({ error: "Post not found" }, 404);

  const [done] = await db
    .update(foodPosts)
    .set({ removedAt: new Date() })
    .where(and(eq(foodPosts.id, postId), isNull(foodPosts.removedAt)))
    .returning({ id: foodPosts.id });
  if (done) {
    broadcastFeedChange();
    audit(c.get("user").userId, "remove post", { postId });
  }
  return c.json({ message: "Removed" });
});

