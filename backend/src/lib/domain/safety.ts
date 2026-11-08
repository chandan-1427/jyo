import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { blocks, foodPosts, pickupRequests, reports } from "../../db/schema.js";
import { broadcastFeedChange } from "../notifications/notificationStream.js";
import { sendReportEmail, type ReportEmail } from "../mailer.js";
import { env } from "../../env.js";
import { ConflictError } from "../errors.js";
import { logger } from "../logger.js";
import { releaseApprovedPickup } from "./requestActions.js";

// For queries over posts: true unless the viewer and the post's poster have
// blocked each other, either way round.
export function notBlockedWith(viewerId: string) {
  return sql<boolean>`not exists (select 1 from ${blocks} where (${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${foodPosts.posterId}) or (${blocks.blockerId} = ${foodPosts.posterId} and ${blocks.blockedId} = ${viewerId}))`;
}

export async function isBlockedBetween(a: string, b: string) {
  const [row] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))
      )
    )
    .limit(1);
  return !!row;
}

// Anything still going on between the two people, either way round, ends,
// and nobody is notified, so the blocked person isn't told:
// - a waiting request: declined when the blocker is the poster, cancelled
//   when the blocker is the one who asked;
// - an approved pickup: called off as the poster's "they didn't come" or the
//   picker's "can't make it" would, so the picker loses the pickup spot.
async function endWhatsBetween(blockerId: string, blockedId: string) {
  const between = or(
    and(eq(pickupRequests.pickerId, blockedId), eq(foodPosts.posterId, blockerId)),
    and(eq(pickupRequests.pickerId, blockerId), eq(foodPosts.posterId, blockedId))
  );
  const columns = { id: pickupRequests.id, postId: pickupRequests.postId, pickerId: pickupRequests.pickerId, isDemo: pickupRequests.isDemo };

  const waiting = await db
    .select(columns)
    .from(pickupRequests)
    .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
    .where(and(eq(pickupRequests.status, "pending"), between));

  const approved = await db
    .select(columns)
    .from(pickupRequests)
    .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
    .where(and(eq(pickupRequests.status, "approved"), eq(foodPosts.status, "closed"), between));

  let reopened = false;
  for (const req of approved) {
    const outcome = await releaseApprovedPickup(req.id, req.postId, req.pickerId === blockerId ? "withdrawn" : "missed");
    if (outcome === "open" && !req.isDemo) reopened = true;
  }

  for (const req of waiting) {
    const status = req.pickerId === blockerId ? "cancelled" : "rejected";
    const ended = await db
      .transaction(async (tx) => {
        const [claimed] = await tx
          .update(pickupRequests)
          .set({ status })
          .where(and(eq(pickupRequests.id, req.id), eq(pickupRequests.status, "pending")))
          .returning({ id: pickupRequests.id });
        if (!claimed) throw new ConflictError();
        const [post] = await tx
          .update(foodPosts)
          .set({ status: "open" })
          .where(and(eq(foodPosts.id, req.postId), eq(foodPosts.status, "pending_approval")))
          .returning({ id: foodPosts.id });
        if (!post) throw new ConflictError();
      })
      .then(() => true)
      .catch((err) => {
        if (err instanceof ConflictError) return false;
        throw err;
      });
    if (ended && !req.isDemo) reopened = true;
  }
  if (reopened) broadcastFeedChange();
}

export async function blockUser(blockerId: string, blockedId: string, label: string) {
  const [created] = await db.insert(blocks).values({ blockerId, blockedId, label }).onConflictDoNothing().returning({ id: blocks.id });
  await endWhatsBetween(blockerId, blockedId);
  return !!created;
}

// Stored once per reporter, person and post; a repeat changes nothing and
// sends no second email.
export async function fileReport(report: Omit<ReportEmail, "reporterId" | "reportedUserId"> & {
  reporterId: string;
  reportedUserId: string;
}) {
  const [created] = await db
    .insert(reports)
    .values({
      reporterId: report.reporterId,
      reportedUserId: report.reportedUserId,
      postId: report.postId,
      postTitle: report.postTitle,
      reason: report.reason as (typeof reports.$inferInsert)["reason"],
      details: report.details || null,
    })
    .onConflictDoNothing()
    .returning({ id: reports.id });

  if (created) {
    logger.info({ reportId: created.id, reason: report.reason }, "Report filed");
    sendReportEmail(env.REPORTS_EMAIL, report);
  }
  return !!created;
}

export async function listBlocks(userId: string) {
  return db
    .select({ id: blocks.id, label: blocks.label, createdAt: blocks.createdAt })
    .from(blocks)
    .where(eq(blocks.blockerId, userId))
    .orderBy(sql`${blocks.createdAt} desc`);
}

export async function unblock(userId: string, blockId: string) {
  await db.delete(blocks).where(and(eq(blocks.id, blockId), eq(blocks.blockerId, userId)));
}

