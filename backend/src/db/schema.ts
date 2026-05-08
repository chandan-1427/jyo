// backend/src/db/schema.ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  doublePrecision,
  integer,
} from "drizzle-orm/pg-core";

// --- Enums ---
export const postStatusEnum = pgEnum("post_status", [
  "open",
  "pending_approval",
  "closed",
  "expired",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

// --- Users ---
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone:        text("phone").notNull(),
  locationText: text("location_text"),
  description:  text("description"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

// --- Food Posts ---
export const foodPosts = pgTable("food_posts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  posterId:          uuid("poster_id").notNull().references(() => users.id),
  title:             text("title").notNull(),
  description:       text("description"),
  photoUrl:          text("photo_url"),
  pickupLat:         doublePrecision("pickup_lat").notNull(),
  pickupLng:         doublePrecision("pickup_lng").notNull(),
  pickupWindowStart: timestamp("pickup_window_start").notNull(),
  pickupWindowEnd:   timestamp("pickup_window_end").notNull(),
  status:            postStatusEnum("status").notNull().default("open"),
  approvedRequestId: uuid("approved_request_id"),             // set after approval
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});

// --- Pickup Requests ---
export const pickupRequests = pgTable("pickup_requests", {
  id:         uuid("id").primaryKey().defaultRandom(),
  postId:     uuid("post_id").notNull().references(() => foodPosts.id),
  pickerId:   uuid("picker_id").notNull().references(() => users.id),
  pickerName: text("picker_name").notNull(),
  selfieUrl:  text("selfie_url"),
  etaMinutes: integer("eta_minutes").notNull(),
  status:     requestStatusEnum("status").notNull().default("pending"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});