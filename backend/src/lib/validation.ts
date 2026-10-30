import { z } from "zod";
import { cursorSchema, limitSchema, searchSchema } from "./pagination.js";

// ─────────────────────────────────────────────────────────────────────────────
// Field rules. frontend/src/lib/validation.ts defines the same `fields`, rule
// for rule and message for message, so a user sees the same wording whether
// the browser or the API rejects their input. validation.parity.test.ts fails
// CI if the two ever disagree. Change a rule here → change it there too.
//
// The API is the real boundary — anyone can call it without our frontend —
// so these are what actually protect the data. The frontend copy only exists
// to give faster, field-level feedback.
// ─────────────────────────────────────────────────────────────────────────────
export const fields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
  loginPassword: z.string().min(1, "Enter your password"),
  locationText: z.string().trim().max(200, "Area is too long"),
  about: z.string().trim().max(500, "About you is too long"),
  etaMinutes: z
    .number({ error: "Enter how many minutes you need" })
    .int("Enter whole minutes")
    .min(1, "Enter at least 1 minute")
    .max(180, "It must be 180 minutes or less"),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
  description: z.string().trim().max(500, "Description is too long"),
};

// ─── Auth ────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: fields.name,
  email: fields.email,
  phone: fields.phone,
  password: fields.newPassword,
});

export const loginSchema = z.object({
  email: fields.email,
  password: fields.loginPassword,
});

export const forgotPasswordSchema = z.object({
  email: fields.email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: fields.newPassword,
});

export const resendVerificationSchema = z.object({
  email: fields.email,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

// ─── Profile ─────────────────────────────────────────────────────────────────
// Every field optional: PATCH /users/me updates only what it's sent.
export const updateProfileSchema = z.object({
  name: fields.name.optional(),
  phone: fields.phone.optional(),
  locationText: fields.locationText.optional(),
  description: fields.about.optional(),
});

// ─── Pickup request ──────────────────────────────────────────────────────────
export const createRequestSchema = z.object({
  postId: z.uuid("Invalid post ID"),
  pickerName: fields.name,
  selfieUrl: z.url("Invalid selfie URL").optional(),
  etaMinutes: fields.etaMinutes,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ─── Feed ────────────────────────────────────────────────────────────────────
// A plain decimal number in range, from the query string: "13abc", "Infinity", "1e9"
// and an empty value are all refused (a bare parseFloat let them through,
// and a demo visitor's sample post is placed at these coordinates).
const queryCoordinate = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/, "Must be a number")
    .transform(Number)
    .pipe(z.number().min(min).max(max));

export const feedQuerySchema = z.object({
  lat: queryCoordinate(-90, 90),
  lng: queryCoordinate(-180, 180),
});

// ─── My posts / My requests (paged) ─────────────────────────────────────────
export const myPostsQuerySchema = z.object({
  status: z.enum(["all", "active", "collected", "ended"]).default("all"),
  search: searchSchema.optional(),
  cursor: cursorSchema.optional(),
  limit: limitSchema.optional(),
});

export const myRequestsQuerySchema = z.object({
  status: z.enum(["all", "waiting", "approved", "collected", "declined", "cancelled"]).default("all"),
  search: searchSchema.optional(),
  cursor: cursorSchema.optional(),
  limit: limitSchema.optional(),
});

// ─── Create / edit post ──────────────────────────────────────────────────────
const postFields = {
  title: fields.title,
  description: fields.description.optional(),
  photoUrl: z.url("Invalid photo URL").optional(),
  pickupWindowStart: z.iso.datetime("Invalid start time"),
  pickupWindowEnd: z.iso.datetime("Invalid end time"),
};

type PickupWindow = { pickupWindowStart: string; pickupWindowEnd: string };

const endAfterStart = (data: PickupWindow) => new Date(data.pickupWindowEnd) > new Date(data.pickupWindowStart);
const endInFuture = (data: PickupWindow) => new Date(data.pickupWindowEnd) > new Date();

// Leftover food doesn't keep, so a pickup can't be set more than a week out.
// The frontend's validation.ts has the same limit, and its date picker stops
// there. The extra hour is slack for a device whose clock runs a little fast.
export const MAX_PICKUP_DAYS_AHEAD = 7;
const endWithinLimit = (data: PickupWindow) =>
  new Date(data.pickupWindowEnd).getTime() <= Date.now() + MAX_PICKUP_DAYS_AHEAD * 86_400_000 + 3_600_000;
const WITHIN_LIMIT = { message: `Pickup has to end within ${MAX_PICKUP_DAYS_AHEAD} days`, path: ["pickupWindowEnd"] };

export const createPostSchema = z
  .object({
    ...postFields,
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
  })
  .refine(endAfterStart, { message: "End time must be after start time", path: ["pickupWindowEnd"] })
  .refine(endInFuture, { message: "End time must be in the future", path: ["pickupWindowEnd"] })
  .refine(endWithinLimit, WITHIN_LIMIT);

// The pickup spot can't be edited: it was checked against the service area
// when the post was made. Omitting photoUrl or description keeps the current
// one, which is why editing is a PATCH rather than a PUT.
export const updatePostSchema = z
  .object(postFields)
  .refine(endAfterStart, { message: "End time must be after start time", path: ["pickupWindowEnd"] })
  .refine(endInFuture, { message: "End time must be in the future", path: ["pickupWindowEnd"] })
  .refine(endWithinLimit, WITHIN_LIMIT);
